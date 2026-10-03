// Whole Source selected functions from immutable config/secrets.ts (MIT Cloudflare 2026).
// Native host resolves only the comment IP salt; preview/encryption config is unsupported.
import type { Kysely } from 'kysely';
import type { Database } from '../database/types.ts';
import { OptionsRepository } from '../database/repositories/options.ts';
import { encodeBase64url } from '../utils/base64.ts';
const GENERATED_SECRET_BYTES = 32;
const IP_SALT_OPTION_KEY = 'emdash:ip_salt';


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
// Internals
// ---------------------------------------------------------------------------

/**
 * Read or generate-and-persist a random base64url secret stored in the
 * options table.
 *
 * Concurrency: `setIfAbsent` is an atomic INSERT...ON CONFLICT DO NOTHING.
 * On race, the loser re-reads to converge on the winner's value.
 */
async function ensureGeneratedOption(
	repo: OptionsRepository,
	optionKey: string,
): Promise<{ value: string; source: "db" }> {
	const existing = await repo.get<string>(optionKey);
	if (typeof existing === "string" && existing.length > 0) {
		return { value: existing, source: "db" };
	}

	const generated = generateRandomSecret();
	const inserted = await repo.setIfAbsent(optionKey, generated);
	if (inserted) {
		return { value: generated, source: "db" };
	}

	// Lost the race — another process inserted first. Re-read to pick up
	// the winner. If the row is somehow still missing or empty, treat that
	// as a real error rather than looping.
	const winner = await repo.get<string>(optionKey);
	if (typeof winner !== "string" || winner.length === 0) {
		throw new EmDashSecretsError(
			`Failed to persist generated secret for "${optionKey}"`,
			"SECRET_PERSIST_FAILED",
		);
	}
	return { value: winner, source: "db" };
}


/** Generate 32 random bytes encoded as unpadded base64url. */
function generateRandomSecret(): string {
	const bytes = new Uint8Array(GENERATED_SECRET_BYTES);
	crypto.getRandomValues(bytes);
	return encodeBase64url(bytes);
}


/** Return the first non-empty string from `values`, or `null` if all are empty. */
function pickFirstNonEmpty(...values: (string | undefined)[]): string | null {
	for (const value of values) {
		if (typeof value === "string" && value.length > 0) {
			return value;
		}
	}
	return null;
}
export async function resolveSecretsCached(db: Kysely<Database>): Promise<{ipSalt:string}> {
 const env = typeof process === 'undefined' ? {} : process.env;
 const configured = pickFirstNonEmpty(env.EMDASH_IP_SALT, env.EMDASH_AUTH_SECRET, env.AUTH_SECRET);
 return { ipSalt: configured ?? (await ensureGeneratedOption(new OptionsRepository(db), IP_SALT_OPTION_KEY)).value };
}
