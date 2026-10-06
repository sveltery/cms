/**
 * @emdash-cms/registry-lexicons
 *
 * Generated TypeScript types and runtime validation schemas for the EmDash
 * plugin registry lexicons under `com.emdashcms.experimental.*`.
 *
 * EXPERIMENTAL: NSIDs and shapes will change. The stable package namespace is
 * expected to be `com.emdashcms.package.*`. Pin to an exact version while we iterate.
 *
 * The exports below are namespace re-exports so consumers can write:
 *
 *   import { PackageProfile } from "@emdash-cms/registry-lexicons";
 *   const profile: PackageProfile.Main = { ... };
 *
 * Each namespace exposes (where applicable):
 *   - `Main`, `<Def>` interfaces — the shape of records / XRPC params / outputs
 *   - `mainSchema`, `<def>Schema` — runtime validators from `@atcute/lexicons`
 *
 * The generated modules also augment `@atcute/lexicons/ambient` `Records` and
 * `XRPCQueries` so `@atcute/client` callers get strong typing automatically.
 */
export * as AggregatorDefs from "./generated/types/com/emdashcms/experimental/aggregator/defs.js";
export * as AggregatorGetLatestRelease from "./generated/types/com/emdashcms/experimental/aggregator/getLatestRelease.js";
export * as AggregatorGetPackage from "./generated/types/com/emdashcms/experimental/aggregator/getPackage.js";
export * as AggregatorListReleases from "./generated/types/com/emdashcms/experimental/aggregator/listReleases.js";
export * as AggregatorResolvePackage from "./generated/types/com/emdashcms/experimental/aggregator/resolvePackage.js";
export * as AggregatorSearchPackages from "./generated/types/com/emdashcms/experimental/aggregator/searchPackages.js";
export * as LabelerDefs from "./generated/types/com/emdashcms/experimental/labeler/defs.js";
export * as LabelerGetAssessment from "./generated/types/com/emdashcms/experimental/labeler/getAssessment.js";
export * as LabelerGetCurrentAssessment from "./generated/types/com/emdashcms/experimental/labeler/getCurrentAssessment.js";
export * as LabelerGetPolicy from "./generated/types/com/emdashcms/experimental/labeler/getPolicy.js";
export * as LabelerListAssessments from "./generated/types/com/emdashcms/experimental/labeler/listAssessments.js";
export * as PackageProfile from "./generated/types/com/emdashcms/experimental/package/profile.js";
export * as PackageProfileExtension from "./generated/types/com/emdashcms/experimental/package/profileExtension.js";
export * as PackageRelease from "./generated/types/com/emdashcms/experimental/package/release.js";
export * as PackageReleaseExtension from "./generated/types/com/emdashcms/experimental/package/releaseExtension.js";
export * as PublisherProfile from "./generated/types/com/emdashcms/experimental/publisher/profile.js";
export * as PublisherVerification from "./generated/types/com/emdashcms/experimental/publisher/verification.js";
/**
 * NSID constants for the lexicons defined by this package. Useful for consumers
 * that need to reference a record collection by string (e.g. when issuing
 * `listRecords` or `putRecord` calls against a PDS).
 */
export const NSID = {
    packageProfile: "com.emdashcms.experimental.package.profile",
    packageProfileExtension: "com.emdashcms.experimental.package.profileExtension",
    packageRelease: "com.emdashcms.experimental.package.release",
    packageReleaseExtension: "com.emdashcms.experimental.package.releaseExtension",
    publisherProfile: "com.emdashcms.experimental.publisher.profile",
    publisherVerification: "com.emdashcms.experimental.publisher.verification",
    aggregatorDefs: "com.emdashcms.experimental.aggregator.defs",
    aggregatorGetLatestRelease: "com.emdashcms.experimental.aggregator.getLatestRelease",
    aggregatorGetPackage: "com.emdashcms.experimental.aggregator.getPackage",
    aggregatorListReleases: "com.emdashcms.experimental.aggregator.listReleases",
    aggregatorResolvePackage: "com.emdashcms.experimental.aggregator.resolvePackage",
    aggregatorSearchPackages: "com.emdashcms.experimental.aggregator.searchPackages",
    labelerDefs: "com.emdashcms.experimental.labeler.defs",
    labelerGetAssessment: "com.emdashcms.experimental.labeler.getAssessment",
    labelerGetCurrentAssessment: "com.emdashcms.experimental.labeler.getCurrentAssessment",
    labelerGetPolicy: "com.emdashcms.experimental.labeler.getPolicy",
    labelerListAssessments: "com.emdashcms.experimental.labeler.listAssessments",
};
export const REGISTRY_CUMULUS_ORIGIN = "https://cdn.em-da.sh";
export const RECORD_SCOPED_BLOB_CACHE_TYPE = `${NSID.aggregatorDefs}#recordScopedBlobCache`;
const DELEGATED_RELEASE_PERMISSION = Object.freeze({
    collection: NSID.packageRelease,
    scope: `atproto repo:${NSID.packageRelease}?action=create blob:application/gzip blob:image/*`,
});
/**
 * Return the exact collection and OAuth scope set used by delegated publishing.
 * A collection or blob-scope change requires every publisher to authorize a new grant.
 */
export function getDelegatedReleasePermission() {
    return DELEGATED_RELEASE_PERMISSION;
}
/**
 * NSIDs of record-shaped lexicons in this package (one row per NSID in the
 * publisher's repo). Embedded objects (`profileExtension`, `releaseExtension`) and shared defs
 * (`aggregator.defs`) are excluded — they don't address their own collection.
 *
 * Useful for consumers building OAuth `repo:` scopes or enumerating writable
 * collections without hand-rolling a list that drifts from the lexicons.
 */
export const RECORD_NSIDS = [
    NSID.packageProfile,
    NSID.packageRelease,
    NSID.publisherProfile,
    NSID.publisherVerification,
];
/**
 * NSIDs of query-shaped lexicons in this package (read-only XRPC methods on
 * the aggregator). Procedures and shared defs are excluded.
 *
 * Useful for consumers building OAuth `rpc:` scopes or enumerating callable
 * AppView endpoints.
 */
export const QUERY_NSIDS = [
    NSID.aggregatorGetLatestRelease,
    NSID.aggregatorGetPackage,
    NSID.aggregatorListReleases,
    NSID.aggregatorResolvePackage,
    NSID.aggregatorSearchPackages,
    NSID.labelerGetAssessment,
    NSID.labelerGetCurrentAssessment,
    NSID.labelerGetPolicy,
    NSID.labelerListAssessments,
];
