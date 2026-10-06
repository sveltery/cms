import { ClientResponseError } from "@atcute/client";
/** Return true only when the aggregator proves one complete observed release history. */
export function isProvenFirstRelease(evidence) {
    return (evidence.releaseHistoryComplete === true &&
        Number.isSafeInteger(evidence.historicalReleaseCount) &&
        evidence.historicalReleaseCount === 1);
}
function normalizeAcceptLabelers(value) {
    const normalized = value?.trim();
    return normalized ? normalized : undefined;
}
export function registryLabelerPolicy(acceptLabelers) {
    const normalized = normalizeAcceptLabelers(acceptLabelers);
    return normalized === undefined
        ? { enforcement: "required" }
        : { enforcement: "required", acceptLabelers: normalized };
}
export function registryLabelerPolicyKey(policy) {
    return `${policy.enforcement}\u0000${normalizeAcceptLabelers(policy.acceptLabelers) ?? "aggregator-default"}`;
}
export async function mapListingStatus(request) {
    try {
        return { status: "passed", value: await request };
    }
    catch (error) {
        if (error instanceof ClientResponseError && error.error === "ListingUnavailable") {
            return { status: "unavailable", reason: "listing-unavailable" };
        }
        throw error;
    }
}
