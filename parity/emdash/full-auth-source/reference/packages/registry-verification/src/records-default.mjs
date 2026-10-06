import { GitHubProvenanceVerifier } from "./provenance.js";
import { verifyPackageReleaseRecordsWithDefaultVerifier, } from "./records.js";
/** Validate signed profile/release records and apply the complete provenance policy. */
export function verifyPackageReleaseRecords(input) {
    return verifyPackageReleaseRecordsWithDefaultVerifier(input, new GitHubProvenanceVerifier());
}
