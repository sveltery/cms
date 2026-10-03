// Selected exact EmDash1.1.0 source declarations: packages/core/src/config/secrets.ts.
// Immutable 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; MIT Copyright2026 Cloudflare Inc.; notices/emdash-MIT.txt.
import {sha256} from "@oslojs/crypto/sha2";
import {encodeHexLowerCase} from "@oslojs/encoding";
import {decodeBase64url,encodeBase64url} from "./base64.ts";


/** v1 encryption key prefix. Bumping requires a separate KDF version. */
export const ENCRYPTION_KEY_PREFIX = "emdash_enc_v1_";


/** 32 random bytes encoded as unpadded base64url = 43 chars. */
const ENCRYPTION_KEY_BODY_LENGTH = 43;


const REGEX_META_PATTERN = /[.*+?^${}()|[\]\\]/g;


/**
 * Built from the prefix constant via interpolation. The prefix has no regex
 * metacharacters today (`emdash_enc_v1_`), but escaping is cheap defense
 * against anyone changing the prefix in a future bump without remembering.
 */
const ENCRYPTION_KEY_PATTERN = new RegExp(
	`^${ENCRYPTION_KEY_PREFIX.replace(REGEX_META_PATTERN, "\\$&")}[A-Za-z0-9_-]{${ENCRYPTION_KEY_BODY_LENGTH}}$`,
);


/** Length in bytes of generated values. 32 bytes = 256 bits. */
const GENERATED_SECRET_BYTES = 32;


/**
 * A parsed encryption key with its kid (key id) fingerprint.
 *
 * `kid` is the first 8 chars of the SHA-256 hash of the decoded key bytes
 * (lowercase hex), used to tag envelopes so the decryptor can pick the right
 * key during rotation.
 */
export interface ParsedEncryptionKey {
	/** 8-char lowercase hex fingerprint derived from the decoded key bytes. */
	kid: string;
	/** The 32 raw key bytes, ready for `crypto.subtle.importKey`. */
	key: Uint8Array;
	/** The original env-var-formatted string (kept for re-emit; never log). */
	raw: string;
}


/** Environment-variable shape consulted by the resolver. */
export interface SecretsEnv {
	/**
	 * Read by `validateEncryptionKeyAtStartup` and the plugin-secret encryption
	 * layer. **Not** consulted by `resolveSecrets`,
	 * so a malformed value can't 500 the preview/comment hot paths.
	 */
	EMDASH_ENCRYPTION_KEY?: string;
	EMDASH_PREVIEW_SECRET?: string;
	/** Legacy alias; new docs point at EMDASH_PREVIEW_SECRET. */
	PREVIEW_SECRET?: string;
	EMDASH_IP_SALT?: string;
	/**
	 * Legacy fallback. Prior code derived the IP salt from
	 * `EMDASH_AUTH_SECRET || AUTH_SECRET || "emdash-ip-salt"`. We preserve
	 * the env-var fallback (so existing installs keep their stable salt)
	 * but no longer read it from `import.meta.env` in route handlers.
	 */
	EMDASH_AUTH_SECRET?: string;
	/** Legacy alias. */
	AUTH_SECRET?: string;
}


/**
 * Class of validation failures raised by this module.
 *
 * Errors here are operator-facing config problems (malformed key, etc.).
 * They are thrown rather than soft-skipped so misconfiguration fails loudly
 * at startup instead of silently degrading at request time.
 */
export class EmDashSecretsError extends Error {
	override readonly name = "EmDashSecretsError";
	readonly code: string;

	constructor(message: string, code: string) {
		super(message);
		this.code = code;
	}
}


// ---------------------------------------------------------------------------
// Encryption key parsing
// ---------------------------------------------------------------------------

/**
 * Parse the `EMDASH_ENCRYPTION_KEY` env var.
 *
 * Accepts a single key or a comma-separated list. The first entry is the
 * primary (used for new writes); all entries are tried for decryption,
 * matched by `kid`. Whitespace around commas is tolerated. Empty entries
 * (e.g. trailing comma) are ignored.
 *
 * Returns `null` for an unset/empty input. Throws `EmDashSecretsError` on
 * any malformed entry — silent skipping would mask deployment mistakes.
 */
export async function parseEncryptionKeys(
	raw: string | undefined,
): Promise<ParsedEncryptionKey[] | null> {
	if (!raw) return null;

	const entries = raw
		.split(",")
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0);

	if (entries.length === 0) return null;

	const parsed: ParsedEncryptionKey[] = [];
	const seenKids = new Set<string>();

	for (const entry of entries) {
		if (!ENCRYPTION_KEY_PATTERN.test(entry)) {
			throw new EmDashSecretsError(
				`EMDASH_ENCRYPTION_KEY entry is malformed (expected "${ENCRYPTION_KEY_PREFIX}" followed by ${ENCRYPTION_KEY_BODY_LENGTH} base64url chars). Generate one with \`emdash secrets generate\`.`,
				"INVALID_ENCRYPTION_KEY",
			);
		}

		const body = entry.slice(ENCRYPTION_KEY_PREFIX.length);
		const key = decodeBase64urlStrict(body);
		if (!key) {
			throw new EmDashSecretsError(
				"EMDASH_ENCRYPTION_KEY body is not valid base64url",
				"INVALID_ENCRYPTION_KEY",
			);
		}
		if (key.length !== GENERATED_SECRET_BYTES) {
			throw new EmDashSecretsError(
				`EMDASH_ENCRYPTION_KEY must decode to ${GENERATED_SECRET_BYTES} bytes, got ${key.length}`,
				"INVALID_ENCRYPTION_KEY",
			);
		}

		// Reject non-canonical base64url. 43 chars decode to 32 bytes but
		// the last char only carries 2 information bits — multiple raw
		// strings can decode to the same bytes. Forcing canonical form
		// guarantees `kid` (derived from bytes) is stable per key
		// material, regardless of how the operator pasted it.
		const canonical = encodeBase64url(key);
		if (canonical !== body) {
			throw new EmDashSecretsError(
				"EMDASH_ENCRYPTION_KEY body is not canonical base64url. Generate one with `emdash secrets generate`.",
				"INVALID_ENCRYPTION_KEY",
			);
		}

		const kid = fingerprintKeyBytes(key);
		if (seenKids.has(kid)) {
			// Duplicate keys are user error (paste mistake during rotation).
			// We dedupe rather than throw — the rotation flow is forgiving.
			continue;
		}
		seenKids.add(kid);
		parsed.push({ kid, key, raw: entry });
	}

	// `parsed` always has at least one entry here: `entries` was non-empty
	// after filtering, the loop runs at least once, the first iteration
	// always passes the empty-`seenKids` check.
	return parsed;
}


/**
 * Resolve the encryption keys used for plugin secret settings.
 *
 * This is deliberately separate from `resolveSecrets`: plugin settings are
 * not on the anonymous request path, and a missing or malformed key must only
 * fail operations that need encrypted plugin settings.
 */
export function resolvePluginEncryptionKeys(
	env?: SecretsEnv,
): Promise<ParsedEncryptionKey[] | null> {
	return parseEncryptionKeys((env ?? readDefaultEnv()).EMDASH_ENCRYPTION_KEY);
}


/**
 * Compute the kid for a raw key string (the env-var form including the
 * `emdash_enc_v1_` prefix). Public so the CLI's `fingerprint` subcommand
 * and admin endpoints can show kids without exposing raw keys.
 *
 * The kid is derived from the decoded key **bytes**, not the raw string,
 * so admin endpoints / future rotation flows can match envelope kids
 * against bytes regardless of how the env var was originally spelled.
 *
 * Validates the same shape as `parseEncryptionKeys` — including canonical
 * base64url — so the CLI can't print a kid for a key the runtime would
 * later refuse to load.
 *
 * Throws `EmDashSecretsError` for malformed or non-canonical input.
 */
export async function fingerprintKey(raw: string): Promise<string> {
	if (!ENCRYPTION_KEY_PATTERN.test(raw)) {
		throw new EmDashSecretsError(
			`Key must match "${ENCRYPTION_KEY_PREFIX}" followed by ${ENCRYPTION_KEY_BODY_LENGTH} base64url chars`,
			"INVALID_ENCRYPTION_KEY",
		);
	}
	const body = raw.slice(ENCRYPTION_KEY_PREFIX.length);
	const bytes = decodeBase64urlStrict(body);
	if (!bytes || bytes.length !== GENERATED_SECRET_BYTES || encodeBase64url(bytes) !== body) {
		throw new EmDashSecretsError(
			`Key body must decode to ${GENERATED_SECRET_BYTES} canonical base64url bytes`,
			"INVALID_ENCRYPTION_KEY",
		);
	}
	return fingerprintKeyBytes(bytes);
}


/**
 * Internal: kid derivation from raw key bytes. The single source of truth
 * for what makes two keys "the same key" — used by both `parseEncryptionKeys`
 * and `fingerprintKey`.
 */
function fingerprintKeyBytes(key: Uint8Array): string {
	return encodeHexLowerCase(sha256(key)).slice(0, 8);
}


/**
 * Generate a fresh `EMDASH_ENCRYPTION_KEY` value. Used by the CLI's
 * `secrets generate` subcommand and by `create-emdash` scaffolding.
 */
export function generateEncryptionKey(): string {
	const bytes = new Uint8Array(GENERATED_SECRET_BYTES);
	crypto.getRandomValues(bytes);
	return `${ENCRYPTION_KEY_PREFIX}${encodeBase64url(bytes)}`;
}


const BASE64URL_CHARSET_PATTERN = /^[A-Za-z0-9_-]+$/;


/**
 * Validate base64url shape and decode. Returns `null` on malformed input
 * (rather than throwing) so the caller can produce a config-specific error.
 */
function decodeBase64urlStrict(input: string): Uint8Array | null {
	// `decodeBase64url` accepts padded input too; the env-var format is
	// strictly unpadded base64url, so we do a charset check first.
	if (!BASE64URL_CHARSET_PATTERN.test(input)) return null;
	try {
		return decodeBase64url(input);
	} catch {
		return null;
	}
}


/**
 * Default env reader.
 *
 * Reads **only** `process.env`. This module must never reference
 * `import.meta.env`: in an Astro/Vite production build the bare
 * `import.meta.env` expression is statically replaced with an object
 * literal built from the env loaded at build time, which (a) embeds any
 * secret present in `.env` on the build machine into the shipped server
 * bundle, and (b) makes that stale build-time value silently shadow the
 * real runtime secret configured on the deployment platform (e.g. via
 * `wrangler secret put`). See #2139.
 *
 * `process.env` is the runtime source on Node/container deployments and
 * on Cloudflare Workers with Node compatibility (the same source
 * `resolveS3Config` in `../storage/s3.ts` uses). The CLI surface
 * (`cli/commands/secrets.ts`) runs outside the bundle where
 * `process.env` is native.
 *
 * The convention documented in AGENTS.md ("import.meta.env.EMDASH_X ||
 * import.meta.env.X") is for public, build-time config in route
 * handlers; secrets are deliberately excluded from it.
 */
function readDefaultEnv(): SecretsEnv {
	const proc = typeof process !== "undefined" && process.env ? process.env : {};

	return {
		EMDASH_ENCRYPTION_KEY: proc.EMDASH_ENCRYPTION_KEY,
		EMDASH_PREVIEW_SECRET: proc.EMDASH_PREVIEW_SECRET,
		PREVIEW_SECRET: proc.PREVIEW_SECRET,
		EMDASH_IP_SALT: proc.EMDASH_IP_SALT,
		EMDASH_AUTH_SECRET: proc.EMDASH_AUTH_SECRET,
		AUTH_SECRET: proc.AUTH_SECRET,
	};
}