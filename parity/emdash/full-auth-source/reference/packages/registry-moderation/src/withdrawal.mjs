import { isVerifiedListingLabel, parseListingLabel, } from "./label-crypto.js";
import { isListingLabelActive, reduceListingLabels } from "./labels.js";
export const LEGACY_RELEASE_WITHDRAWAL_LABEL = "security:yanked";
export const RELEASE_WITHDRAWAL_LABEL = "security-yanked";
const RELEASE_WITHDRAWAL_VALUES = new Set([
    LEGACY_RELEASE_WITHDRAWAL_LABEL,
    RELEASE_WITHDRAWAL_LABEL,
]);
export function evaluateReleaseWithdrawal(input) {
    for (const label of input.labels) {
        if (!isVerifiedListingLabel(label)) {
            throw new TypeError("withdrawal labels must be verified before evaluation");
        }
    }
    return evaluateReleaseWithdrawalCore(input);
}
/** Evaluates labels loaded from a store that authenticated them before persistence. */
export function evaluateHydratedReleaseWithdrawal(input) {
    return evaluateReleaseWithdrawalCore({
        ...input,
        labels: input.labels.map((label) => parseListingLabel(label)),
    });
}
function evaluateReleaseWithdrawalCore(input) {
    const acceptedSources = input.acceptedSources === undefined ? null : new Set(input.acceptedSources);
    const reduction = reduceListingLabels(input.labels, input.evaluatedAt);
    const applicableLabels = reduction.states.flatMap((state) => {
        const candidates = state.collision.length > 0 ? state.collision : state.active ? [state.winner] : [];
        return candidates.filter((label) => RELEASE_WITHDRAWAL_VALUES.has(label.val) &&
            isListingLabelActive(label, input.evaluatedAt) &&
            label.uri === input.uri &&
            (label.cid === undefined || label.cid === input.cid) &&
            (acceptedSources === null || acceptedSources.has(label.src)));
    });
    return { withdrawn: applicableLabels.length > 0, applicableLabels };
}
