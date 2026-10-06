import { evaluateHydratedReleaseWithdrawal, parseListingLabel, } from "@emdash-cms/registry-moderation";
function acceptedSources(policy) {
    if (!policy.acceptLabelers)
        return undefined;
    return policy.acceptLabelers
        .split(",")
        .map((entry) => entry.trim().split(";", 1)[0])
        .filter((source) => Boolean(source));
}
/**
 * Evaluates hydrated release-withdrawal labels through the shared moderation
 * policy. Malformed hydrated labels fail closed instead of being skipped.
 */
export function evaluateRegistryReleaseWithdrawal(release, policy, options = {}) {
    const labels = [];
    try {
        for (const label of release.labels ?? [])
            labels.push(parseListingLabel(label));
    }
    catch {
        return { withdrawn: true, applicableLabels: [], malformed: true };
    }
    const result = evaluateHydratedReleaseWithdrawal({
        uri: release.uri,
        cid: release.cid,
        labels,
        evaluatedAt: options.evaluatedAt ?? new Date(),
        acceptedSources: acceptedSources(policy),
    });
    return { ...result, malformed: false };
}
