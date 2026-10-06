// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// Source 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e:packages/core/src/import/ssrf.ts; complete import-adapted body.
/**
 * @deprecated Re-export shim. The SSRF helpers moved to
 * `packages/core/src/security/ssrf.ts` because they're now used outside
 * the import pipeline (registry installs, future trusted-fetch use
 * cases). New code should import from `#security/ssrf.js` directly.
 *
 * Existing import-pipeline callers keep working unchanged through this
 * shim. Remove once all callers have migrated.
 */

export {
	cloudflareDohResolver,
	resolveAndValidateExternalUrl,
	setDefaultDnsResolver,
	SsrfError,
	ssrfSafeFetch,
	stripCredentialHeaders,
	validateExternalUrl,
	normalizeIPv6MappedToIPv4,
	type DnsResolver,
} from "../security/ssrf.ts";
