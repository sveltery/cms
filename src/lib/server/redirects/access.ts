// EmDash1.1.0 MIT, Copyright2026 Cloudflare Inc.; notices/emdash-MIT.txt.
// Immutable913cb1bb9b7f08c3ff0d258b4420e53835b6a58e whole authorities retained.
// Complete Source redirect access/revision functions; native imports and erasable constructor.
import type {Kysely} from 'kysely';
import type {Database} from './database-types.ts';
import {RedirectRepository,type Redirect,type VersionedRedirectRecord} from './repository.ts';
import {handleRedirectList,handleRedirectCreate,handleRedirectUpdate,handleRedirectDelete} from './handlers.ts';
import {createRedirectBody,updateRedirectBody} from './schemas.ts';
import type {RedirectInfo,RedirectStatus,VersionedRedirect,RedirectAccess,RedirectAccessWithWrite,RedirectCreateInput,RedirectUpdateInput,RedirectListOptions} from './plugin-types.ts';

export class RedirectAccessError extends Error {
	override readonly name = "RedirectAccessError";

	readonly code: string;
	constructor(
		code: string,
		message: string,
	) {
		super(message);this.code=code;
	}
}

const REDIRECT_REVISION_PREFIX = "r1.";
const BASE64_PADDING_RE = /=+$/;

function encodeRedirectRevision(id: string, revision: string): string {
	const payload = `${id}\0${revision}`;
	return `${REDIRECT_REVISION_PREFIX}${btoa(payload)
		.replaceAll("+", "-")
		.replaceAll("/", "_")
		.replace(BASE64_PADDING_RE, "")}`;
}

function decodeRedirectRevision(id: string, revision: string): string {
	if (typeof revision !== "string" || !revision.startsWith(REDIRECT_REVISION_PREFIX)) {
		throw new RedirectAccessError("INVALID_PRECONDITION", "Invalid redirect revision");
	}
	try {
		const encoded = revision
			.slice(REDIRECT_REVISION_PREFIX.length)
			.replaceAll("-", "+")
			.replaceAll("_", "/");
		const padded = encoded.padEnd(Math.ceil(encoded.length / 4) * 4, "=");
		const [revisionId, updatedAt, extra] = atob(padded).split("\0");
		if (revisionId !== id || !updatedAt || extra !== undefined) throw new Error("invalid");
		return updatedAt;
	} catch (error) {
		if (error instanceof RedirectAccessError) throw error;
		throw new RedirectAccessError("INVALID_PRECONDITION", "Invalid redirect revision");
	}
}

function toRedirectInfo(redirect: Redirect): RedirectInfo {
	return {
		...redirect,
		type: redirect.type as RedirectStatus,
	};
}

function toVersionedRedirect(record: VersionedRedirectRecord): VersionedRedirect {
	return {
		redirect: toRedirectInfo(record.redirect),
		_rev: encodeRedirectRevision(record.redirect.id, record.configRevision),
	};
}

async function readVersionedRedirect(
	repo: RedirectRepository,
	id: string,
): Promise<VersionedRedirect | null> {
	const record = await repo.findVersionedById(id);
	return record ? toVersionedRedirect(record) : null;
}

function throwRedirectResult(error: { code: string; message: string }): never {
	throw new RedirectAccessError(error.code, error.message);
}

function assertNoAutomaticRedirectMarker(input: object): void {
	if (typeof input !== "object" || input === null || Array.isArray(input)) {
		throw new RedirectAccessError("VALIDATION_ERROR", "Redirect input must be an object");
	}
	if (Object.hasOwn(input, "auto")) {
		throw new RedirectAccessError(
			"VALIDATION_ERROR",
			"The automatic redirect marker is managed by EmDash",
		);
	}
}

export function createRedirectAccess(db: Kysely<Database>): RedirectAccess;
export function createRedirectAccess(db: Kysely<Database>, writable: true): RedirectAccessWithWrite;
export function createRedirectAccess(
	db: Kysely<Database>,
	writable = false,
): RedirectAccess | RedirectAccessWithWrite {
	const repo = new RedirectRepository(db);
	const readAccess: RedirectAccess = {
		async list(options: RedirectListOptions = {}) {
			const result = await handleRedirectList(db, options);
			if (!result.success) return throwRedirectResult(result.error);
			return {
				items: result.data.items.map(toRedirectInfo),
				cursor: result.data.nextCursor,
				hasMore: result.data.nextCursor !== undefined,
			};
		},
		get: (id: string) => readVersionedRedirect(repo, id),
	};
	if (!writable) return readAccess;

	return {
		...readAccess,
		async create(input: RedirectCreateInput) {
			assertNoAutomaticRedirectMarker(input);
			const parsed = createRedirectBody.safeParse(input);
			if (!parsed.success) {
				throw new RedirectAccessError(
					"VALIDATION_ERROR",
					parsed.error.issues[0]?.message ?? "Invalid redirect",
				);
			}
			const result = await handleRedirectCreate(db, parsed.data);
			if (!result.success) return throwRedirectResult(result.error);
			const current = await readVersionedRedirect(repo, result.data.id);
			if (!current) throw new RedirectAccessError("NOT_FOUND", "Created redirect not found");
			return current;
		},
		async update(id: string, input: RedirectUpdateInput & { _rev: string }) {
			assertNoAutomaticRedirectMarker(input);
			const { _rev, ...patch } = input;
			const expectedRevision = decodeRedirectRevision(id, _rev);
			const parsed = updateRedirectBody.safeParse(patch);
			if (!parsed.success) {
				throw new RedirectAccessError(
					"VALIDATION_ERROR",
					parsed.error.issues[0]?.message ?? "Invalid redirect",
				);
			}
			const result = await handleRedirectUpdate(db, id, parsed.data, { expectedRevision });
			if (!result.success) return throwRedirectResult(result.error);
			const current = await readVersionedRedirect(repo, result.data.id);
			if (!current) throw new RedirectAccessError("NOT_FOUND", "Updated redirect not found");
			return current;
		},
		async delete(id: string, options: { _rev: string }) {
			if (typeof options !== "object" || options === null) {
				throw new RedirectAccessError("INVALID_PRECONDITION", "Invalid redirect revision");
			}
			const expectedRevision = decodeRedirectRevision(id, options._rev);
			const result = await handleRedirectDelete(db, id, { expectedRevision });
			if (!result.success) return throwRedirectResult(result.error);
			return result.data.deleted;
		},
	};
}

