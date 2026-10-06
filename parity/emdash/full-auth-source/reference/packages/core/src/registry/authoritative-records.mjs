import { DirectPdsClient, DirectPdsReadError } from "@emdash-cms/registry-client/direct-pds";
import { fetchVerifiedResource, inspectPackageReleaseRecords, verifyMultihash, verifyPackageReleaseRecords, } from "@emdash-cms/registry-verification";
import { cloudflareDohResolver, ssrfSafeFetch } from "../security/ssrf.js";
const MAX_PROVENANCE_BYTES = 5 * 1024 * 1024;
const AUTHORITATIVE_READER_OVERRIDE = Symbol.for("emdash.registry.authoritativeRecordReader");
export function setDefaultAuthoritativeRecordReaderForTesting(reader) {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Symbol.for state must survive duplicated SSR module chunks.
    const state = globalThis;
    const previous = state[AUTHORITATIVE_READER_OVERRIDE];
    state[AUTHORITATIVE_READER_OVERRIDE] = reader;
    return previous;
}
export async function readAuthoritativePackageRelease(publisherDid, packageSlug, version, options = {}) {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Symbol.for state must survive duplicated SSR module chunks.
    const override = globalThis[AUTHORITATIVE_READER_OVERRIDE];
    if (override)
        return override(publisherDid, packageSlug, version, options);
    try {
        const client = new DirectPdsClient({
            did: publisherDid,
            fetch: options.fetch ?? guardedFetch,
            didDocumentResolver: options.didDocumentResolver,
        });
        const [profile, release] = await Promise.all([
            client.getPackageProfile(packageSlug),
            client.getPackageRelease(packageSlug, version),
        ]);
        const inspection = await inspectPackageReleaseRecords({
            publisherDid,
            package: packageSlug,
            version,
            rkey: release.rkey,
            profileCid: profile.cid,
            profile: profile.value,
            release: release.value,
        });
        if (!inspection.success) {
            return {
                success: false,
                error: {
                    code: inspection.code,
                    message: inspection.reasons[0]?.message ?? "The signed package records are invalid.",
                },
            };
        }
        return {
            success: true,
            value: { publisherDid, packageSlug, version, profile, release, inspection },
        };
    }
    catch (error) {
        if (error instanceof DirectPdsReadError) {
            return { success: false, error: { code: error.code, message: error.message } };
        }
        return {
            success: false,
            error: {
                code: "AUTHORITATIVE_RECORD_READ_FAILED",
                message: "The publisher's signed package records could not be verified.",
            },
        };
    }
}
export async function verifyAuthoritativePackageRelease(records, artifactDigest, options = {}) {
    const context = records.inspection.value;
    const provenanceReference = context.releaseExtension.provenance;
    if (provenanceReference && context.repository === null) {
        return verificationFailure("PROVENANCE_UNVERIFIABLE", "The release supplies provenance, but its signed profile has no repository anchor.");
    }
    let document;
    if (provenanceReference) {
        const fetched = await fetchVerifiedResource(provenanceReference.url, {
            fetch: options.provenanceFetch ?? defaultProvenanceFetch,
            resolveHostname: options.resolveHostname ?? cloudflareDohResolver,
            maxBytes: MAX_PROVENANCE_BYTES,
        });
        if (!fetched.success) {
            return verificationFailure(fetched.error.code, fetched.error.message);
        }
        const checksum = await verifyMultihash(fetched.value.bytes, provenanceReference.checksum);
        if (!checksum.success) {
            return verificationFailure(checksum.error.code, checksum.error.message);
        }
        document = fetched.value.bytes;
    }
    return verifyPackageReleaseRecords({
        publisherDid: records.publisherDid,
        package: records.packageSlug,
        version: records.version,
        rkey: records.release.rkey,
        profileCid: records.profile.cid,
        profile: records.profile.value,
        release: records.release.value,
        provenance: document === undefined
            ? undefined
            : {
                document,
                artifactDigest,
                artifactDigests: options.artifactDigests,
                verifier: options.provenanceVerifier,
            },
    });
}
function verificationFailure(code, message) {
    return {
        success: false,
        status: "failed",
        code,
        reasons: [{ code, message }],
        provenance: { status: "failed" },
    };
}
const guardedFetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    return ssrfSafeFetch(url, init, { httpsOnly: true });
};
const defaultProvenanceFetch = (input, init) => globalThis.fetch(input, init);
