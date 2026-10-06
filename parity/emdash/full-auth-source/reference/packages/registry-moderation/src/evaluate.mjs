import { isVerifiedListingLabel, parseListingLabel, } from "./label-crypto.js";
import { LISTING_LABELS, isListingLabelActive, reduceListingLabels, } from "./labels.js";
import { PROFILE_COLLECTION, RELEASE_COLLECTION } from "./labels.js";
import { assertListingModerationPolicy, stateSources, } from "./policy.js";
import { assertCanonicalCid, assertDid, parseAtUri } from "./validation.js";
const TERMINAL_VALUES = new Set([
    LISTING_LABELS.passed,
    LISTING_LABELS.pending,
    LISTING_LABELS.review,
    LISTING_LABELS.error,
]);
function validateSubject(subject) {
    assertDid(subject.publisherDid, "subject.publisherDid");
    assertCanonicalCid(subject.cid, "subject.cid");
    const parsed = parseAtUri(subject.uri, "subject.uri");
    if (parsed.authority !== subject.publisherDid) {
        throw new TypeError("subject.uri authority must match subject.publisherDid");
    }
    const expectedCollection = subject.kind === "profile" ? PROFILE_COLLECTION : RELEASE_COLLECTION;
    if (parsed.collection !== expectedCollection) {
        throw new TypeError("subject.uri collection must match subject.kind");
    }
    if (subject.profileUri !== undefined) {
        const profile = parseAtUri(subject.profileUri, "subject.profileUri");
        if (profile.authority !== subject.publisherDid || profile.collection !== PROFILE_COLLECTION) {
            throw new TypeError("subject.profileUri must identify the publisher's profile record");
        }
    }
}
function appliesToRevision(label, subject) {
    return label.uri === subject.uri && label.cid === subject.cid;
}
function result(state, reasonCodes, positiveSources, missingPositiveSources, applicableLabels) {
    return {
        visible: state === "passed",
        state,
        reasonCodes,
        positiveSources,
        missingPositiveSources,
        applicableLabels,
    };
}
function evaluateListingVisibilityCore(input) {
    assertListingModerationPolicy(input.policy);
    validateSubject(input.subject);
    if (input.subject.deleted) {
        return result("deleted", ["publisher-deleted"], [], input.policy.requiredPositiveSources, []);
    }
    if (input.subject.tombstoned) {
        return result("tombstoned", ["publisher-tombstoned"], [], input.policy.requiredPositiveSources, []);
    }
    const reduction = reduceListingLabels(input.labels, input.evaluatedAt);
    const acceptedStates = stateSources(input.policy);
    const active = reduction.states.filter((state) => state.active).map((state) => state.winner);
    const collisionCandidates = reduction.states
        .flatMap((state) => state.collision)
        .filter((label) => isListingLabelActive(label, input.evaluatedAt));
    const enforcementCandidates = [...active, ...collisionCandidates];
    const redactionUris = new Set([input.subject.uri, input.subject.profileUri, input.subject.publisherDid].filter((value) => value !== undefined));
    const takedowns = enforcementCandidates.filter((label) => label.val === LISTING_LABELS.takedown &&
        input.policy.redactionSources.includes(label.src) &&
        redactionUris.has(label.uri) &&
        (label.cid === undefined ||
            (label.uri === input.subject.uri && label.cid === input.subject.cid)));
    if (takedowns.length > 0) {
        return result("takedown", ["active-takedown"], [], input.policy.requiredPositiveSources, takedowns);
    }
    const applicable = active.filter((label) => acceptedStates.has(label.src) && appliesToRevision(label, input.subject));
    const collisionApplicable = collisionCandidates.filter((label) => acceptedStates.has(label.src) && appliesToRevision(label, input.subject));
    const blocks = [...applicable, ...collisionApplicable].filter((label) => label.val === LISTING_LABELS.blocked);
    if (blocks.length > 0) {
        return result("blocked", ["exact-cid-block"], [], input.policy.requiredPositiveSources, [
            ...applicable,
            ...collisionApplicable,
        ]);
    }
    const collisions = reduction.states.filter((state) => state.collision.length > 0 &&
        state.collision.some((label) => isListingLabelActive(label, input.evaluatedAt) &&
            acceptedStates.has(label.src) &&
            appliesToRevision(label, input.subject)));
    const terminalValues = new Set(applicable.filter((label) => TERMINAL_VALUES.has(label.val)).map((label) => label.val));
    if (collisions.length > 0 || terminalValues.size > 1) {
        return result("conflict", ["conflicting-terminal-state"], [], input.policy.requiredPositiveSources, applicable);
    }
    const positiveSources = input.policy.requiredPositiveSources.filter((source) => applicable.some((label) => label.src === source && label.val === LISTING_LABELS.passed));
    const missingPositiveSources = input.policy.requiredPositiveSources.filter((source) => !positiveSources.includes(source));
    if (missingPositiveSources.length === 0) {
        return result("passed", ["required-positive-labels"], positiveSources, [], applicable);
    }
    const reasonCodes = ["missing-required-positive-label"];
    if (applicable.some((label) => label.val === LISTING_LABELS.pending)) {
        reasonCodes.push("listing-pending");
    }
    if (applicable.some((label) => label.val === LISTING_LABELS.review)) {
        reasonCodes.push("listing-review");
    }
    if (applicable.some((label) => label.val === LISTING_LABELS.error)) {
        reasonCodes.push("listing-error");
    }
    if (applicable.some((label) => label.val === LISTING_LABELS.overridden)) {
        reasonCodes.push("override-without-pass");
    }
    return result("unavailable", reasonCodes, positiveSources, missingPositiveSources, applicable);
}
export function evaluateListingVisibility(input) {
    for (const label of input.labels) {
        if (!isVerifiedListingLabel(label)) {
            throw new TypeError("labels must be verified by verifyListingLabel before visibility evaluation");
        }
    }
    return evaluateListingVisibilityCore(input);
}
/**
 * Evaluates structurally validated labels loaded from an already authenticated store.
 * This function does not verify signatures and must never receive network or client input.
 */
export function evaluateHydratedListingVisibility(input) {
    return evaluateListingVisibilityCore({
        ...input,
        labels: input.labels.map((label) => parseListingLabel(label)),
    });
}
export function selectLatestApprovedRevision(input) {
    if (input.currentDeleted)
        return null;
    const candidates = input.revisions
        .filter((revision) => evaluateListingVisibility({
        subject: revision,
        policy: input.policy,
        labels: input.labels,
        evaluatedAt: input.evaluatedAt,
    }).visible)
        .toSorted((left, right) => right.observedAt.localeCompare(left.observedAt));
    return candidates[0] ?? null;
}
/** Selects from labels whose signatures were verified before persistence. */
export function selectLatestHydratedApprovedRevision(input) {
    if (input.currentDeleted)
        return null;
    const candidates = input.revisions
        .filter((revision) => evaluateHydratedListingVisibility({
        subject: revision,
        policy: input.policy,
        labels: input.labels,
        evaluatedAt: input.evaluatedAt,
    }).visible)
        .toSorted((left, right) => right.observedAt.localeCompare(left.observedAt));
    return candidates[0] ?? null;
}
