// @ts-nocheck -- pinned complete registration callbacks; fixture wrapper is checked separately.
// Copyright2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
// Extracted whole taxonomy registrations/pure helpers from immutable
// packages/core/src/mcp/server.ts at913cb1bb9b7f08c3ff0d258b4420e53835b6a58e.
// This is a test-only native handler registrar, not an MCP server or SDK transport.
import {z} from 'zod';
import {createTaxonomyDefBody,updateTaxonomyDefBody} from '../../src/lib/server/taxonomies/upstream/api/schemas/taxonomies.ts';
import {Role} from './taxonomy-auth.ts';
import {hasScope} from '../../src/lib/server/taxonomies/upstream/auth.ts';
import {taxonomyTag} from '../../src/lib/server/taxonomies/upstream/cache/chrome-tags.ts';
import {decodeCursor,InvalidCursorError} from '../../src/lib/server/taxonomies/upstream/database/repositories/types.ts';
import {decodeBase64,encodeBase64} from '../../src/lib/server/taxonomies/upstream/utils/base64.ts';
type EmDashHandlers={db:any};type EmDashExtra={emdash:EmDashHandlers;userRole:number;tokenScopes?:string[];cache?:any};type RoleLevel=number;
const TAXONOMY_CURSOR_VERSION = 2;

const MAX_TAXONOMY_CURSOR_LENGTH = 2048;

type HandlerResult = {
	success: boolean;
	data?: unknown;
	error?: unknown;
};

type SuccessEnvelope = {
	content: Array<{ type: "text"; text: string }>;
	structuredContent?: Record<string, unknown>;
	_meta?: Record<string, unknown>;
};

type ErrorEnvelope = {
	content: Array<{ type: "text"; text: string }>;
	isError: true;
	_meta: { code: string; details?: Record<string, unknown> };
};

type TaxonomyListCursor = { id: string };

function encodeTaxonomyCursor(term: { id: string }): string {
	const cursor = encodeBase64(
		JSON.stringify({
			v: TAXONOMY_CURSOR_VERSION,
			id: term.id,
		}),
	);
	if (cursor.length > MAX_TAXONOMY_CURSOR_LENGTH) {
		throw new InvalidCursorError(cursor);
	}
	return cursor;
}

function decodeTaxonomyCursor(cursor: string): TaxonomyListCursor {
	if (!cursor || cursor.length > MAX_TAXONOMY_CURSOR_LENGTH) {
		throw new InvalidCursorError(cursor);
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(decodeBase64(cursor));
	} catch {
		throw new InvalidCursorError(cursor);
	}

	if (parsed === null || typeof parsed !== "object") {
		throw new InvalidCursorError(cursor);
	}

	const candidate = parsed as Record<string, unknown>;
	if ("v" in candidate) {
		const { v, id } = candidate;
		if (
			v !== TAXONOMY_CURSOR_VERSION ||
			typeof id !== "string" ||
			id.length === 0 ||
			id.includes("\0")
		) {
			throw new InvalidCursorError(cursor);
		}
		return { id };
	}

	const legacy = decodeCursor(cursor);
	if (legacy.orderValue.includes("\0") || legacy.id.length === 0 || legacy.id.includes("\0")) {
		throw new InvalidCursorError(cursor);
	}
	return { id: legacy.id };
}

function respondData(data: unknown): SuccessEnvelope {
	return {
		content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
	};
}

function respondError(
	code: string,
	message: string,
	details?: Record<string, unknown>,
): ErrorEnvelope {
	const text = `[${code}] ${message}`;
	const meta: { code: string; details?: Record<string, unknown> } = { code };
	if (details !== undefined) meta.details = details;
	return {
		content: [{ type: "text", text }],
		isError: true,
		_meta: meta,
	};
}

class EmDashAuthError extends Error {
	override readonly name = "EmDashAuthError";
	constructor(
		message: string,
		readonly code: string,
	) {
		super(message);
	}
}

function respondHandlerError(error: unknown, fallbackCode = "INTERNAL_ERROR"): ErrorEnvelope {
	let code = fallbackCode;
	let message: string;
	let details: Record<string, unknown> | undefined;

	if (error instanceof EmDashAuthError) {
		message = error.message || fallbackCode;
		code = error.code;
	} else if (error instanceof Error) {
		message = error.message || fallbackCode;
		const apiError = (error as { apiError?: { code?: string; details?: unknown } }).apiError;
		if (apiError && typeof apiError.code === "string" && apiError.code) {
			code = apiError.code;
			if (apiError.details && typeof apiError.details === "object") {
				details = apiError.details as Record<string, unknown>;
			}
		} else {
			// Errors that carry their own `code` (SchemaError, custom errors).
			// Skip numeric codes (McpError, Node fs errors) — `_meta.code` is
			// reserved for stable string codes.
			const rawCode = (error as { code?: unknown }).code;
			if (typeof rawCode === "string" && rawCode) {
				code = rawCode;
			}
			const rawDetails = (error as { details?: unknown }).details;
			if (rawDetails && typeof rawDetails === "object") {
				details = rawDetails as Record<string, unknown>;
			}
		}
	} else if (typeof error === "string") {
		message = error;
	} else {
		message = String(error);
	}

	return respondError(code, message, details);
}

function unwrap(result: HandlerResult): SuccessEnvelope | ErrorEnvelope {
	if (result.success && result.data !== undefined) {
		return respondData(result.data);
	}
	const err =
		result.error && typeof result.error === "object"
			? (result.error as { code?: unknown; message?: unknown; details?: unknown })
			: undefined;
	if (!err) return respondError("INTERNAL_ERROR", "Unknown error");
	const code = typeof err.code === "string" && err.code ? err.code : "INTERNAL_ERROR";
	const message = typeof err.message === "string" && err.message ? err.message : "Unknown error";
	const details =
		err.details && typeof err.details === "object"
			? (err.details as Record<string, unknown>)
			: undefined;
	return respondError(code, message, details);
}

function jsonResult(data: unknown): SuccessEnvelope {
	return respondData(data);
}

function getExtra(extra: { authInfo?: { extra?: Record<string, unknown> } }): EmDashExtra {
	const payload = extra.authInfo?.extra as EmDashExtra | undefined;
	if (!payload?.emdash) {
		throw new Error("EmDash not available — server misconfigured");
	}
	return payload;
}

function getEmDash(extra: { authInfo?: { extra?: Record<string, unknown> } }): EmDashHandlers {
	return getExtra(extra).emdash;
}

async function unwrapAndInvalidate(
	extra: { authInfo?: { extra?: Record<string, unknown> } },
	result: HandlerResult,
	tags: string[],
	changedEarlier = false,
): Promise<SuccessEnvelope | ErrorEnvelope> {
	if (result.success || changedEarlier) {
		const { cache } = getExtra(extra);
		if (cache?.enabled) await cache.invalidate({ tags });
	}
	return unwrap(result);
}

function requireScope(
	extra: { authInfo?: { extra?: Record<string, unknown> } },
	scope: string,
): void {
	const payload = getExtra(extra);
	if (payload.tokenScopes && !hasScope(payload.tokenScopes, scope)) {
		throw new EmDashAuthError(`Insufficient scope: requires ${scope}`, "INSUFFICIENT_SCOPE");
	}
}

function requireRole(
	extra: { authInfo?: { extra?: Record<string, unknown> } },
	minRole: RoleLevel,
): void {
	const payload = getExtra(extra);
	if (payload.userRole < minRole) {
		throw new EmDashAuthError(
			"Insufficient permissions for this operation",
			"INSUFFICIENT_PERMISSIONS",
		);
	}
}
export function registerTaxonomyHandlers(server:any){
server.registerTool(
		"taxonomy_list",
		{
			title: "List Taxonomies",
			description:
				"List all taxonomy definitions (e.g. categories, tags). Taxonomies are " +
				"classification systems applied to content. Each has a name, label, and " +
				"can be hierarchical (categories) or flat (tags). Optionally filter by " +
				"locale.",
			inputSchema: z.object({
				locale: z.string().optional().describe("Filter by locale (omit for all)"),
			}),
			annotations: { readOnlyHint: true },
		},
		async (args, extra) => {
			requireScope(extra, "content:read");
			const ec = getEmDash(extra);
			try {
				const { handleTaxonomyList } = await import("../../src/lib/server/taxonomies/upstream/api/handlers/taxonomies.ts");
				return unwrap(await handleTaxonomyList(ec.db, { locale: args.locale }));
			} catch (error) {
				return respondHandlerError(error, "TAXONOMY_LIST_ERROR");
			}
		},
	);

server.registerTool(
		"taxonomy_get",
		{
			title: "Get Taxonomy Definition",
			description:
				"Get a single taxonomy definition by name. Taxonomy definitions describe " +
				"a classification system (e.g. categories or tags), which collections " +
				"it applies to, and whether it is hierarchical. Pass `locale` to resolve " +
				"a specific translation; otherwise the lowest matching locale is returned.",
			inputSchema: z.object({
				name: z.string().describe("Taxonomy name (e.g. 'categories', 'tags')"),
				locale: z.string().optional().describe("Locale to resolve the definition for"),
			}),
			annotations: { readOnlyHint: true },
		},
		async (args, extra) => {
			requireScope(extra, "content:read");
			const ec = getEmDash(extra);
			try {
				const { handleTaxonomyGet } = await import("../../src/lib/server/taxonomies/upstream/api/handlers/taxonomies.ts");
				return unwrap(await handleTaxonomyGet(ec.db, args.name, { locale: args.locale }));
			} catch (error) {
				return respondHandlerError(error, "TAXONOMY_GET_ERROR");
			}
		},
	);

server.registerTool(
		"taxonomy_create",
		{
			title: "Create Taxonomy Definition",
			description:
				"Create a taxonomy definition in one locale. `label` and `labelSingular` " +
				"belong to that locale; `hierarchical` and `collections` belong to the " +
				"taxonomy and are the same in every locale. `collections` names which " +
				"content types the taxonomy applies to. A definition for a name that " +
				"already exists in another locale joins that taxonomy and takes its " +
				"`hierarchical` and `collections`; passing different values is an error " +
				"(change them with taxonomy_update).",
			inputSchema: z.object({
				name: createTaxonomyDefBody.shape.name.describe(
					"Taxonomy name (lowercase letters, numbers, underscores)",
				),
				label: createTaxonomyDefBody.shape.label.describe("Display name"),
				labelSingular: createTaxonomyDefBody.shape.labelSingular.describe(
					"Singular form of the display name",
				),
				hierarchical: createTaxonomyDefBody.shape.hierarchical.describe(
					"Whether the taxonomy supports parent/child terms, in every locale (defaults to false; must match when the taxonomy exists in another locale)",
				),
				collections: createTaxonomyDefBody.shape.collections.describe(
					"Collection slugs this taxonomy applies to, in every locale (defaults to []; must match when the taxonomy exists in another locale)",
				),
				locale: z.string().optional().describe("Locale for this definition (e.g. 'fr-fr')"),
				translationOf: z
					.string()
					.optional()
					.describe("Existing taxonomy definition id to create this locale variant from"),
			}),
		},
		async (args, extra) => {
			requireScope(extra, "taxonomies:manage");
			requireRole(extra, Role.EDITOR);
			const ec = getEmDash(extra);
			try {
				const { handleTaxonomyCreate } = await import("../../src/lib/server/taxonomies/upstream/api/handlers/taxonomies.ts");
				return unwrapAndInvalidate(
					extra,
					await handleTaxonomyCreate(ec.db, {
						name: args.name,
						label: args.label,
						labelSingular: args.labelSingular,
						hierarchical: args.hierarchical,
						collections: args.collections,
						locale: args.locale,
						translationOf: args.translationOf,
					}),
					[taxonomyTag(args.name)],
				);
			} catch (error) {
				return respondHandlerError(error, "TAXONOMY_CREATE_ERROR");
			}
		},
	);

server.registerTool(
		"taxonomy_update",
		{
			title: "Update Taxonomy Definition",
			description:
				"Update an existing taxonomy definition. The taxonomy `name` cannot be " +
				"changed. Pass `locale` to update a specific translation's `label` and " +
				"`labelSingular`; otherwise the lowest matching locale is updated. " +
				"`hierarchical` and `collections` change for every locale. Any field " +
				"may be omitted to leave it unchanged.",
			inputSchema: z.object({
				name: z.string().describe("Taxonomy name to update"),
				label: updateTaxonomyDefBody.shape.label.describe("New display name"),
				labelSingular: updateTaxonomyDefBody.shape.labelSingular.describe(
					"New singular display name; pass null to clear",
				),
				hierarchical: updateTaxonomyDefBody.shape.hierarchical.describe(
					"Whether the taxonomy supports parent/child terms, in every locale",
				),
				collections: updateTaxonomyDefBody.shape.collections.describe(
					"Collection slugs this taxonomy applies to, in every locale",
				),
				locale: z.string().optional().describe("Locale of the definition to update"),
			}),
		},
		async (args, extra) => {
			requireScope(extra, "taxonomies:manage");
			requireRole(extra, Role.EDITOR);
			const ec = getEmDash(extra);
			try {
				const { handleTaxonomyUpdate } = await import("../../src/lib/server/taxonomies/upstream/api/handlers/taxonomies.ts");
				return unwrapAndInvalidate(
					extra,
					await handleTaxonomyUpdate(ec.db, args.name, {
						label: args.label,
						labelSingular: args.labelSingular,
						hierarchical: args.hierarchical,
						collections: args.collections,
						locale: args.locale,
					}),
					[taxonomyTag(args.name)],
				);
			} catch (error) {
				return respondHandlerError(error, "TAXONOMY_UPDATE_ERROR");
			}
		},
	);

server.registerTool(
		"taxonomy_delete",
		{
			title: "Delete Taxonomy Definition",
			description:
				"Delete a taxonomy definition and all of its terms in every locale, " +
				"along with any content assignments those terms hold. This cannot be undone.",
			inputSchema: z.object({
				name: z.string().describe("Taxonomy name to delete"),
			}),
			annotations: { destructiveHint: true },
		},
		async (args, extra) => {
			requireScope(extra, "taxonomies:manage");
			requireRole(extra, Role.EDITOR);
			const ec = getEmDash(extra);
			try {
				const { handleTaxonomyDelete } = await import("../../src/lib/server/taxonomies/upstream/api/handlers/taxonomies.ts");
				return unwrapAndInvalidate(extra, await handleTaxonomyDelete(ec.db, args.name), [
					taxonomyTag(args.name),
				]);
			} catch (error) {
				return respondHandlerError(error, "TAXONOMY_DELETE_ERROR");
			}
		},
	);

server.registerTool(
		"taxonomy_list_terms",
		{
			title: "List Taxonomy Terms",
			description:
				"List terms in a taxonomy with pagination. Terms are individual entries " +
				"(e.g. specific categories or tags). Hierarchical taxonomies can have " +
				"parent-child relationships.",
			inputSchema: z.object({
				taxonomy: z.string().describe("Taxonomy name (e.g. 'categories', 'tags')"),
				limit: z.number().int().min(1).max(100).optional().describe("Max items (default 50)"),
				cursor: z
					.string()
					.min(1)
					.max(MAX_TAXONOMY_CURSOR_LENGTH)
					.optional()
					.describe("Pagination cursor"),
				locale: z.string().optional().describe("Filter by locale (omit for all)"),
			}),
			annotations: { readOnlyHint: true },
		},
		async (args, extra) => {
			requireScope(extra, "content:read");
			const ec = getEmDash(extra);
			try {
				const { handleTaxonomyList } = await import("../../src/lib/server/taxonomies/upstream/api/handlers/taxonomies.ts");
				const listResult = await handleTaxonomyList(ec.db, { locale: args.locale });
				if (!listResult.success) return unwrap(listResult);

				const taxonomies = (listResult.data as { taxonomies: Array<{ name: string; id?: string }> })
					.taxonomies;
				const taxonomy = taxonomies.find((t: { name: string }) => t.name === args.taxonomy);
				if (!taxonomy) return respondError("NOT_FOUND", `Taxonomy '${args.taxonomy}' not found`);

				const { TaxonomyRepository } = await import("../../src/lib/server/taxonomies/upstream/database/repositories/taxonomy.ts");
				const repo = new TaxonomyRepository(ec.db);
				const limit = Math.max(1, Math.min(args.limit ?? 50, 100));
				let cursor: TaxonomyListCursor | undefined;
				if (args.cursor) {
					try {
						cursor = decodeTaxonomyCursor(args.cursor);
					} catch (error) {
						if (error instanceof InvalidCursorError) {
							return respondError("INVALID_CURSOR", error.message);
						}
						throw error;
					}
				}

				let pageCursor: { sortOrder: number; label: string; id: string } | undefined;
				if (cursor) {
					const cursorTerm = await repo.findById(cursor.id);
					if (
						!cursorTerm ||
						cursorTerm.name !== args.taxonomy ||
						(args.locale !== undefined && cursorTerm.locale !== args.locale)
					) {
						return respondError("INVALID_CURSOR", "Pagination cursor no longer identifies a term");
					}
					pageCursor = {
						sortOrder: cursorTerm.sortOrder,
						label: cursorTerm.label,
						id: cursorTerm.id,
					};
				}

				const page = await repo.findPageByName(args.taxonomy, {
					locale: args.locale,
					limit,
					...(pageCursor ? { cursor: pageCursor } : {}),
				});
				const last = page.items.at(-1);
				const nextCursor = page.hasMore && last ? encodeTaxonomyCursor(last) : undefined;

				return jsonResult({
					items: page.items.map((t) => ({
						id: t.id,
						name: t.name,
						slug: t.slug,
						label: t.label,
						parentId: t.parentId,
						description: typeof t.data?.description === "string" ? t.data.description : undefined,
						locale: t.locale,
						translationGroup: t.translationGroup,
					})),
					nextCursor,
				});
			} catch (error) {
				return respondHandlerError(error, "TAXONOMY_LIST_TERMS_ERROR");
			}
		},
	);

server.registerTool(
		"taxonomy_create_term",
		{
			title: "Create Taxonomy Term",
			description:
				"Create a new term in a taxonomy. For hierarchical taxonomies like " +
				"categories, you can specify a parentId to create a child term. The " +
				"parent must exist and belong to the same taxonomy. The parent's " +
				"ancestor chain must not exceed 100 levels — attempts to attach a " +
				"new term beneath a chain of 100+ existing ancestors are rejected.",
			inputSchema: z.object({
				taxonomy: z.string().describe("Taxonomy name (e.g. 'categories', 'tags')"),
				slug: z
					.string()
					.min(1)
					.optional()
					.describe("URL identifier for the term; omit to derive it from the label"),
				label: z.string().describe("Display name"),
				parentId: z.string().optional().describe("Parent term ID for hierarchical taxonomies"),
				description: z.string().optional().describe("Description of the term"),
				locale: z.string().optional().describe("Locale for the new term (e.g. 'es')"),
				translationOf: z
					.string()
					.optional()
					.describe(
						"Term id to join as a translation (same translation_group). The new term takes that term's parent and position; a different parentId moves the term in every locale",
					),
			}),
		},
		async (args, extra) => {
			requireScope(extra, "taxonomies:manage");
			requireRole(extra, Role.EDITOR);
			const ec = getEmDash(extra);
			try {
				const { handleTermCreate } = await import("../../src/lib/server/taxonomies/upstream/api/handlers/taxonomies.ts");
				return unwrapAndInvalidate(
					extra,
					await handleTermCreate(ec.db, args.taxonomy, {
						slug: args.slug,
						label: args.label,
						parentId: args.parentId,
						description: args.description,
						locale: args.locale,
						translationOf: args.translationOf,
					}),
					[taxonomyTag(args.taxonomy)],
				);
			} catch (error) {
				return respondHandlerError(error, "TAXONOMY_TERM_CREATE_ERROR");
			}
		},
	);

server.registerTool(
		"taxonomy_update_term",
		{
			title: "Update Taxonomy Term",
			description:
				"Update an existing term in a taxonomy. Any field can be omitted to leave " +
				"it unchanged. Renaming a term's slug must not collide with another term in " +
				"the same taxonomy. Set parentId to null to detach from a parent. The new " +
				"parent must exist, belong to the same taxonomy, and not introduce a cycle " +
				"(a term cannot be its own ancestor). The new parent's ancestor chain must " +
				"not exceed 100 levels — reparenting under a chain of 100+ ancestors is " +
				"rejected. Translations of a term can share a slug: pass `locale` to " +
				"update a specific translation; otherwise the lowest matching locale is " +
				"updated.",
			inputSchema: z.object({
				taxonomy: z.string().describe("Taxonomy name (e.g. 'categories', 'tags')"),
				termSlug: z.string().describe("Current slug of the term to update"),
				slug: z.string().optional().describe("New slug (must be unique in the taxonomy)"),
				label: z.string().optional().describe("New display name"),
				parentId: z.string().nullable().optional().describe("New parent term ID; null to detach"),
				description: z.string().optional().describe("New description"),
				locale: z.string().optional().describe("Locale of the term to update (e.g. 'fr')"),
			}),
		},
		async (args, extra) => {
			requireScope(extra, "taxonomies:manage");
			requireRole(extra, Role.EDITOR);
			const ec = getEmDash(extra);
			try {
				const { handleTermUpdate } = await import("../../src/lib/server/taxonomies/upstream/api/handlers/taxonomies.ts");
				return unwrapAndInvalidate(
					extra,
					await handleTermUpdate(
						ec.db,
						args.taxonomy,
						args.termSlug,
						{
							slug: args.slug,
							label: args.label,
							parentId: args.parentId,
							description: args.description,
						},
						{ locale: args.locale },
					),
					[taxonomyTag(args.taxonomy)],
				);
			} catch (error) {
				return respondHandlerError(error, "TAXONOMY_TERM_UPDATE_ERROR");
			}
		},
	);

server.registerTool(
		"taxonomy_delete_term",
		{
			title: "Delete Taxonomy Term",
			description:
				"Permanently delete a term from a taxonomy. Any content tagged with this " +
				"term loses the association. Cannot delete a term that has children — " +
				"delete children first. Translations of a term can share a slug: pass " +
				"`locale` to delete a specific translation; otherwise the lowest matching " +
				"locale is deleted.",
			inputSchema: z.object({
				taxonomy: z.string().describe("Taxonomy name"),
				termSlug: z.string().describe("Slug of the term to delete"),
				locale: z.string().optional().describe("Locale of the term to delete (e.g. 'fr')"),
			}),
			annotations: { destructiveHint: true },
		},
		async (args, extra) => {
			requireScope(extra, "taxonomies:manage");
			requireRole(extra, Role.EDITOR);
			const ec = getEmDash(extra);
			try {
				const { handleTermDelete } = await import("../../src/lib/server/taxonomies/upstream/api/handlers/taxonomies.ts");
				return unwrapAndInvalidate(
					extra,
					await handleTermDelete(ec.db, args.taxonomy, args.termSlug, { locale: args.locale }),
					[taxonomyTag(args.taxonomy)],
				);
			} catch (error) {
				return respondHandlerError(error, "TAXONOMY_TERM_DELETE_ERROR");
			}
		},
	);

server.registerTool(
		"taxonomy_term_translations",
		{
			title: "List Term Translations",
			description:
				"Return every locale variant of a taxonomy term, identified via its shared translation_group.",
			inputSchema: z.object({
				id: z.string().describe("Term id (or translation_group)"),
			}),
			annotations: { readOnlyHint: true },
		},
		async (args, extra) => {
			requireScope(extra, "content:read");
			const ec = getEmDash(extra);
			try {
				const { handleTermTranslations } = await import("../../src/lib/server/taxonomies/upstream/api/handlers/taxonomies.ts");
				return unwrap(await handleTermTranslations(ec.db, args.id));
			} catch (error) {
				return respondHandlerError(error, "TERM_TRANSLATIONS_ERROR");
			}
		},
	);
}
export {respondHandlerError};
