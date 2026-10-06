/**
 * Plugin Context v2
 *
 * Creates the unified context object provided to plugins in all hooks and routes.
 *
 */
import mime from "mime/lite";
import { ulid } from "ulidx";
import { GLOBAL_UPLOAD_ALLOWLIST } from "../api/handlers/media-allowlist.js";
import { handleMediaDelete } from "../api/handlers/media.js";
import { handleRedirectCreate, handleRedirectDelete, handleRedirectList, handleRedirectUpdate, } from "../api/handlers/redirects.js";
import { handleTermCreate } from "../api/handlers/taxonomies.js";
import { CONTENT_TYPE_RE } from "../api/schemas/media.js";
import { createRedirectBody, updateRedirectBody } from "../api/schemas/redirects.js";
import { CommentRepository } from "../database/repositories/comment.js";
import { ContentRepository } from "../database/repositories/content.js";
import { EntryLockRepository } from "../database/repositories/entry-locks.js";
import { MediaRepository } from "../database/repositories/media.js";
import { OptionsRepository } from "../database/repositories/options.js";
import { PluginStorageRepository } from "../database/repositories/plugin-storage.js";
import { RedirectRepository, } from "../database/repositories/redirect.js";
import { SeoRepository } from "../database/repositories/seo.js";
import { findTaxonomyStructure, selectTaxonomyDefs, } from "../database/repositories/taxonomy-def.js";
import { TaxonomyRepository } from "../database/repositories/taxonomy.js";
import { UserRepository } from "../database/repositories/user.js";
import { withTransaction } from "../database/transaction.js";
import { getI18nConfig, resolveContentCreateLocale } from "../i18n/config.js";
import { resolveAndValidateExternalUrl, SsrfError, stripCredentialHeaders, } from "../import/ssrf.js";
import { enrichImageMetadata } from "../media/enrich.js";
import { matchesMimeAllowlist, normalizeMime } from "../media/mime.js";
import { markContentMediaUsageCollectionStaleSafely } from "../media/usage/content-refresh.js";
import { SchemaRegistry } from "../schema/registry.js";
import { invalidateSiteSettingsCache } from "../settings/index.js";
import { createBylineAccess } from "./byline-access.js";
import { assertStorageKey } from "./conditional-storage.js";
import { createContentAccess } from "./content-access.js";
import { CronAccessImpl } from "./cron.js";
import { bufferPluginHttpRequest, pluginHttpRedirectAction, pluginHttpResponseFromWire, pluginHttpResponseToWire, rewritePluginHttpRedirect, } from "./http-wire.js";
import { readPluginMediaBytes, toPluginMediaItem, updatePluginMediaMetadata } from "./media.js";
import { PluginRouteError } from "./route-error.js";
import { createPluginSecretRedactor, createSettingsAccess, } from "./settings.js";
export { createContentAccess } from "./content-access.js";
// =============================================================================
// KV Access
// =============================================================================
/**
 * Create KV accessor for a plugin
 * All keys are automatically prefixed with the plugin ID
 */
export function createKVAccess(optionsRepo, pluginId, settings = createSettingsAccess(optionsRepo, pluginId)) {
    const prefix = `plugin:${pluginId}:`;
    return {
        async get(key) {
            if (key.startsWith("settings:"))
                return settings.get(key.slice("settings:".length));
            return optionsRepo.get(`${prefix}${key}`);
        },
        async getVersioned(key) {
            assertStorageKey(key);
            if (key.startsWith("settings:")) {
                return settings.getVersioned(key.slice("settings:".length));
            }
            return optionsRepo.getVersioned(`${prefix}${key}`);
        },
        async compareAndSet(key, expectedRevision, value) {
            assertStorageKey(key);
            if (key.startsWith("settings:")) {
                return settings.compareAndSet(key.slice("settings:".length), expectedRevision, value);
            }
            return optionsRepo.compareAndSet(`${prefix}${key}`, expectedRevision, value);
        },
        async compareAndDelete(key, expectedRevision) {
            assertStorageKey(key);
            if (key.startsWith("settings:")) {
                return settings.compareAndDelete(key.slice("settings:".length), expectedRevision);
            }
            return optionsRepo.compareAndDelete(`${prefix}${key}`, expectedRevision);
        },
        async set(key, value) {
            if (key.startsWith("settings:")) {
                await settings.set(key.slice("settings:".length), value);
                return;
            }
            await optionsRepo.set(`${prefix}${key}`, value);
        },
        async delete(key) {
            if (key.startsWith("settings:"))
                return settings.delete(key.slice("settings:".length));
            return optionsRepo.delete(`${prefix}${key}`);
        },
        async list(keyPrefix) {
            const requestedPrefix = keyPrefix ?? "";
            const includesSettings = "settings:".startsWith(requestedPrefix) || requestedPrefix.startsWith("settings:");
            const fullPrefix = `${prefix}${requestedPrefix}`;
            const entriesMap = requestedPrefix.startsWith("settings:")
                ? new Map()
                : await optionsRepo.getByPrefix(fullPrefix);
            const result = [];
            for (const [fullKey, value] of entriesMap) {
                if (includesSettings && fullKey.startsWith(`${prefix}settings:`))
                    continue;
                result.push({
                    key: fullKey.slice(prefix.length),
                    value,
                });
            }
            if (includesSettings) {
                const settingPrefix = requestedPrefix.startsWith("settings:")
                    ? requestedPrefix.slice("settings:".length)
                    : "";
                for (const entry of await settings.list(settingPrefix)) {
                    const key = `settings:${entry.key}`;
                    if (key.startsWith(requestedPrefix))
                        result.push({ key, value: entry.value });
                }
            }
            return result;
        },
    };
}
// =============================================================================
// Storage Access
// =============================================================================
/**
 * Create storage collection accessor for a plugin
 * Wraps PluginStorageRepository with the v2 interface (no async iterators)
 */
function createStorageCollection(db, pluginId, collectionName, indexes) {
    const repo = new PluginStorageRepository(db, pluginId, collectionName, indexes);
    return {
        get: (id) => repo.get(id),
        getVersioned: (id) => repo.getVersioned(id),
        compareAndSet: (id, expectedRevision, data) => repo.compareAndSet(id, expectedRevision, data),
        compareAndDelete: (id, expectedRevision) => repo.compareAndDelete(id, expectedRevision),
        put: (id, data) => repo.put(id, data),
        delete: (id) => repo.delete(id),
        exists: (id) => repo.exists(id),
        getMany: (ids) => repo.getMany(ids),
        putMany: (items) => repo.putMany(items),
        deleteMany: (ids) => repo.deleteMany(ids),
        count: (where) => repo.count(where),
        updateIf: (id, updateArgs) => repo.updateIf(id, updateArgs),
        // Query returns PaginatedResult instead of the old format
        async query(options) {
            const result = await repo.query({
                where: options?.where,
                orderBy: options?.orderBy,
                limit: options?.limit,
                cursor: options?.cursor,
            });
            return {
                items: result.items,
                cursor: result.cursor,
                hasMore: result.hasMore,
            };
        },
    };
}
/**
 * Create storage accessor with all declared collections
 */
export function createStorageAccess(db, pluginId, storageConfig) {
    const storage = {};
    for (const [collectionName, config] of Object.entries(storageConfig)) {
        const allIndexes = [...config.indexes, ...(config.uniqueIndexes ?? [])];
        storage[collectionName] = createStorageCollection(db, pluginId, collectionName, allIndexes);
    }
    return storage;
}
// =============================================================================
// Content Access
// =============================================================================
/**
 * Extract `seo` from a plugin-supplied content write input and return both
 * parts. Mutates nothing — returns a new field map without the `seo` key.
 */
function splitSeoFromInput(input) {
    const { seo, ...fields } = input;
    // Reject non-object seo values rather than silently dropping them.
    if (seo !== undefined && (seo === null || typeof seo !== "object" || Array.isArray(seo))) {
        throw new Error("content.seo must be an object");
    }
    return { fields, seo };
}
/**
 * Reject writing SEO to a collection that does not have it enabled.
 * Matches the REST API behavior (VALIDATION_ERROR).
 */
async function assertSeoEnabled(seoRepo, collection, seo) {
    const hasSeo = await seoRepo.isEnabled(collection);
    if (seo !== undefined && !hasSeo) {
        throw new Error(`Collection "${collection}" does not have SEO enabled. ` +
            `Remove the seo field or enable SEO on this collection.`);
    }
    return hasSeo;
}
/**
 * Parse the `collections` JSON column into a string array (`[]` on anything
 * else). Mirrors the guards in the Cloudflare/workerd bridges so an
 * in-process plugin degrades on malformed data instead of crashing.
 */
function parseCollectionsColumn(value) {
    if (!value)
        return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed)
            ? parsed.filter((item) => typeof item === "string")
            : [];
    }
    catch {
        return [];
    }
}
/** Map a repository `Taxonomy` row to the plugin-facing term shape. */
function taxonomyToTermInfo(term) {
    return {
        id: term.id,
        taxonomy: term.name,
        slug: term.slug,
        label: term.label,
        parentId: term.parentId,
        data: term.data,
        locale: term.locale,
        translationGroup: term.translationGroup,
    };
}
function collectionToSchemaInfo(collection) {
    if (!collection)
        return null;
    return {
        slug: collection.slug,
        label: collection.label,
        labelSingular: collection.labelSingular ?? null,
        description: collection.description ?? null,
        supports: collection.supports,
        hasSeo: collection.hasSeo,
        titleField: collection.titleField ?? null,
        dateField: collection.dateField ?? null,
        urlPattern: collection.urlPattern ?? null,
        routable: collection.routable !== false,
        hidden: collection.hidden,
        fields: collection.fields.map((field) => ({
            slug: field.slug,
            label: field.label,
            type: field.type,
            required: field.required,
            unique: field.unique,
            ...(field.defaultValue === undefined ? {} : { default: field.defaultValue }),
            ...(field.validation === undefined ? {} : { validation: field.validation }),
            ...(field.widget === undefined ? {} : { widget: field.widget }),
            ...(field.options === undefined ? {} : { options: field.options }),
            searchable: field.searchable,
            indexed: field.indexed,
            translatable: field.translatable,
            sortOrder: field.sortOrder,
        })),
    };
}
export function createSchemaAccess(db) {
    const registry = new SchemaRegistry(db);
    return {
        async listCollections() {
            const collections = [];
            for (const collection of await registry.listCollectionsWithFields()) {
                const info = collectionToSchemaInfo(collection);
                if (info)
                    collections.push(info);
            }
            return collections;
        },
        async getCollection(slug) {
            return collectionToSchemaInfo(await registry.getCollectionWithFields(slug));
        },
    };
}
/**
 * Create read-only taxonomy access (gated on `taxonomies:read`).
 */
export function createTaxonomyAccess(db) {
    const taxonomyRepo = new TaxonomyRepository(db);
    return {
        async getAll(options) {
            let query = selectTaxonomyDefs(db);
            if (options?.locale !== undefined)
                query = query.where("d.locale", "=", options.locale);
            const rows = await query.orderBy("d.name", "asc").execute();
            return rows.map((row) => ({
                name: row.name,
                label: row.label,
                labelSingular: row.label_singular,
                hierarchical: row.hierarchical === 1,
                collections: parseCollectionsColumn(row.collections),
                locale: row.locale,
            }));
        },
        async getTerms(taxonomy, options) {
            const terms = await taxonomyRepo.findByName(taxonomy, { locale: options?.locale });
            return terms.map(taxonomyToTermInfo);
        },
        async getEntryTerms(collection, entryId, options) {
            const terms = await taxonomyRepo.getTermsForEntry(collection, entryId, options?.taxonomy, options?.locale);
            return terms.map(taxonomyToTermInfo);
        },
    };
}
function toPluginComment(comment) {
    if (comment.status === "trash")
        throw new Error("Trashed comments are not plugin-readable");
    return {
        id: comment.id,
        collection: comment.collection,
        contentId: comment.contentId,
        parentId: comment.parentId,
        authorName: comment.authorName,
        authorEmail: comment.authorEmail,
        body: comment.body,
        status: comment.status,
        ipHash: comment.ipHash,
        userAgent: comment.userAgent,
        moderationMetadata: comment.moderationMetadata,
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt,
    };
}
export function createCommentAccess(db, moderate) {
    const repo = new CommentRepository(db);
    return {
        async get(id) {
            const comment = await repo.findById(id);
            return !comment || comment.status === "trash" ? null : toPluginComment(comment);
        },
        async list(options = {}) {
            const result = await repo.findForPlugin(options);
            return {
                items: result.items.map(toPluginComment),
                cursor: result.nextCursor,
                hasMore: result.nextCursor !== undefined,
            };
        },
        count: (options) => repo.countForPlugin(options),
        ...(moderate
            ? {
                setStatus: (id, status, options) => moderate(id, status, options.expectedStatus),
            }
            : {}),
    };
}
export class RedirectAccessError extends Error {
    code;
    name = "RedirectAccessError";
    constructor(code, message) {
        super(message);
        this.code = code;
    }
}
const REDIRECT_REVISION_PREFIX = "r1.";
const BASE64_PADDING_RE = /=+$/;
function encodeRedirectRevision(id, revision) {
    const payload = `${id}\0${revision}`;
    return `${REDIRECT_REVISION_PREFIX}${btoa(payload)
        .replaceAll("+", "-")
        .replaceAll("/", "_")
        .replace(BASE64_PADDING_RE, "")}`;
}
function decodeRedirectRevision(id, revision) {
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
        if (revisionId !== id || !updatedAt || extra !== undefined)
            throw new Error("invalid");
        return updatedAt;
    }
    catch (error) {
        if (error instanceof RedirectAccessError)
            throw error;
        throw new RedirectAccessError("INVALID_PRECONDITION", "Invalid redirect revision");
    }
}
function toRedirectInfo(redirect) {
    return {
        ...redirect,
        type: redirect.type,
    };
}
function toVersionedRedirect(record) {
    return {
        redirect: toRedirectInfo(record.redirect),
        _rev: encodeRedirectRevision(record.redirect.id, record.configRevision),
    };
}
async function readVersionedRedirect(repo, id) {
    const record = await repo.findVersionedById(id);
    return record ? toVersionedRedirect(record) : null;
}
function throwRedirectResult(error) {
    throw new RedirectAccessError(error.code, error.message);
}
function assertNoAutomaticRedirectMarker(input) {
    if (typeof input !== "object" || input === null || Array.isArray(input)) {
        throw new RedirectAccessError("VALIDATION_ERROR", "Redirect input must be an object");
    }
    if (Object.hasOwn(input, "auto")) {
        throw new RedirectAccessError("VALIDATION_ERROR", "The automatic redirect marker is managed by EmDash");
    }
}
export function createRedirectAccess(db, writable = false) {
    const repo = new RedirectRepository(db);
    const readAccess = {
        async list(options = {}) {
            const result = await handleRedirectList(db, options);
            if (!result.success)
                return throwRedirectResult(result.error);
            return {
                items: result.data.items.map(toRedirectInfo),
                cursor: result.data.nextCursor,
                hasMore: result.data.nextCursor !== undefined,
            };
        },
        get: (id) => readVersionedRedirect(repo, id),
    };
    if (!writable)
        return readAccess;
    return {
        ...readAccess,
        async create(input) {
            assertNoAutomaticRedirectMarker(input);
            const parsed = createRedirectBody.safeParse(input);
            if (!parsed.success) {
                throw new RedirectAccessError("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid redirect");
            }
            const result = await handleRedirectCreate(db, parsed.data);
            if (!result.success)
                return throwRedirectResult(result.error);
            const current = await readVersionedRedirect(repo, result.data.id);
            if (!current)
                throw new RedirectAccessError("NOT_FOUND", "Created redirect not found");
            return current;
        },
        async update(id, input) {
            assertNoAutomaticRedirectMarker(input);
            const { _rev, ...patch } = input;
            const expectedRevision = decodeRedirectRevision(id, _rev);
            const parsed = updateRedirectBody.safeParse(patch);
            if (!parsed.success) {
                throw new RedirectAccessError("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid redirect");
            }
            const result = await handleRedirectUpdate(db, id, parsed.data, { expectedRevision });
            if (!result.success)
                return throwRedirectResult(result.error);
            const current = await readVersionedRedirect(repo, result.data.id);
            if (!current)
                throw new RedirectAccessError("NOT_FOUND", "Updated redirect not found");
            return current;
        },
        async delete(id, options) {
            if (typeof options !== "object" || options === null) {
                throw new RedirectAccessError("INVALID_PRECONDITION", "Invalid redirect revision");
            }
            const expectedRevision = decodeRedirectRevision(id, options._rev);
            const result = await handleRedirectDelete(db, id, { expectedRevision });
            if (!result.success)
                return throwRedirectResult(result.error);
            return result.data.deleted;
        },
    };
}
const MAX_TAXONOMY_DELTA_TERMS = 64;
function taxonomyAccessError(code, message) {
    return Object.assign(new Error(message), { code });
}
async function resolveTaxonomyDelta(db, collection, entryId, taxonomy, termIds) {
    if (termIds.length > MAX_TAXONOMY_DELTA_TERMS) {
        throw taxonomyAccessError("VALIDATION_ERROR", `A taxonomy assignment delta can contain at most ${MAX_TAXONOMY_DELTA_TERMS} term IDs`);
    }
    if (termIds.some((id) => typeof id !== "string" || id.length === 0)) {
        throw taxonomyAccessError("VALIDATION_ERROR", "Taxonomy term IDs must be non-empty strings");
    }
    const structure = await findTaxonomyStructure(db, taxonomy);
    if (!structure) {
        throw taxonomyAccessError("NOT_FOUND", `Taxonomy '${taxonomy}' not found`);
    }
    const attached = structure.collections.includes(collection);
    if (!attached) {
        throw taxonomyAccessError("VALIDATION_ERROR", `Taxonomy '${taxonomy}' is not attached to collection '${collection}'`);
    }
    const entry = await new ContentRepository(db).findById(collection, entryId);
    if (!entry) {
        throw taxonomyAccessError("NOT_FOUND", `Content entry '${entryId}' not found in '${collection}'`);
    }
    const repo = new TaxonomyRepository(db);
    const groups = [];
    for (const id of new Set(termIds)) {
        const term = await repo.findByIdOrTranslationGroup(id);
        if (!term)
            throw taxonomyAccessError("NOT_FOUND", `Taxonomy term '${id}' not found`);
        if (term.name !== taxonomy) {
            throw taxonomyAccessError("VALIDATION_ERROR", `Taxonomy term '${id}' belongs to '${term.name}', not '${taxonomy}'`);
        }
        groups.push(term.translationGroup ?? term.id);
    }
    return { repo, groups, locale: entry.locale ?? getI18nConfig()?.defaultLocale ?? "en" };
}
async function readResolvedEntryTerms(repo, collection, entryId, taxonomy, locale) {
    const defaultLocale = getI18nConfig()?.defaultLocale ?? locale;
    const assignments = await repo.getTermAssignmentsForEntry(collection, entryId, taxonomy, locale, defaultLocale);
    return assignments.flatMap(({ term }) => (term ? [taxonomyToTermInfo(term)] : []));
}
export function createTaxonomyAccessWithWrite(db) {
    return {
        ...createTaxonomyAccess(db),
        async createTerm(taxonomy, input) {
            const result = await handleTermCreate(db, taxonomy, input);
            if (!result.success)
                throw taxonomyAccessError(result.error.code, result.error.message);
            const { term } = result.data;
            return {
                id: term.id,
                taxonomy: term.name,
                slug: term.slug,
                label: term.label,
                parentId: term.parentId,
                data: term.description ? { description: term.description } : null,
                locale: term.locale,
                translationGroup: term.translationGroup,
            };
        },
        async addEntryTerms(collection, entryId, taxonomy, termIds) {
            const { repo, groups, locale } = await resolveTaxonomyDelta(db, collection, entryId, taxonomy, termIds);
            await repo.attachGroupsToEntry(collection, entryId, groups);
            return readResolvedEntryTerms(repo, collection, entryId, taxonomy, locale);
        },
        async removeEntryTerms(collection, entryId, taxonomy, termIds) {
            const { repo, groups, locale } = await resolveTaxonomyDelta(db, collection, entryId, taxonomy, termIds);
            await repo.detachGroupsFromEntry(collection, entryId, groups);
            return readResolvedEntryTerms(repo, collection, entryId, taxonomy, locale);
        },
    };
}
async function afterContentWrite(recordWrite) {
    if (typeof recordWrite === "function")
        await recordWrite();
}
/**
 * Create full content access with write operations.
 *
 * `create` and `update` accept a reserved `seo` key in their `data`
 * argument. When present, it is routed to the core SEO panel
 * (`_emdash_seo`) via `SeoRepository.upsert`, in the same transaction as
 * the content write. The returned `ContentItem.seo` reflects the resulting
 * SEO state for SEO-enabled collections.
 */
export function createContentAccessWithWrite(db, beforeContentWrite, accessOptions, contentCreate) {
    const readAccess = createContentAccess(db, accessOptions);
    return {
        ...readAccess,
        async create(collection, data, options) {
            const locale = resolveContentCreateLocale(options?.locale);
            const recordWrite = await beforeContentWrite?.();
            if (contentCreate) {
                const created = await contentCreate({
                    collection,
                    input: data,
                    options: { ...options, locale },
                });
                await afterContentWrite(recordWrite);
                return created;
            }
            const { fields, seo } = splitSeoFromInput(data);
            let contentMutated = false;
            try {
                const created = await withTransaction(db, async (trx) => {
                    const trxContentRepo = new ContentRepository(trx);
                    const trxSeoRepo = new SeoRepository(trx);
                    const hasSeo = await assertSeoEnabled(trxSeoRepo, collection, seo);
                    const item = await trxContentRepo.create({
                        type: collection,
                        data: fields,
                        locale,
                        translationOf: options?.translationOf,
                    });
                    contentMutated = true;
                    const result = {
                        id: item.id,
                        type: item.type,
                        slug: item.slug,
                        status: item.status,
                        data: item.data,
                        createdAt: item.createdAt,
                        updatedAt: item.updatedAt,
                        locale: item.locale,
                        publishedAt: item.publishedAt,
                        scheduledAt: item.scheduledAt,
                    };
                    if (hasSeo) {
                        result.seo =
                            seo !== undefined
                                ? await trxSeoRepo.upsert(collection, item.id, seo)
                                : await trxSeoRepo.get(collection, item.id);
                    }
                    return result;
                });
                await markContentMediaUsageCollectionStaleSafely(db, collection, "CONTENT_USAGE_STALE");
                await afterContentWrite(recordWrite);
                return created;
            }
            catch (error) {
                if (contentMutated) {
                    await markContentMediaUsageCollectionStaleSafely(db, collection, "CONTENT_USAGE_STALE");
                }
                throw error;
            }
        },
        async update(collection, id, data) {
            const recordWrite = await beforeContentWrite?.();
            const { fields, seo } = splitSeoFromInput(data);
            const hasFieldUpdates = Object.keys(fields).length > 0;
            let contentMutated = false;
            try {
                const updated = await withTransaction(db, async (trx) => {
                    const trxContentRepo = new ContentRepository(trx);
                    const trxSeoRepo = new SeoRepository(trx);
                    const hasSeo = await assertSeoEnabled(trxSeoRepo, collection, seo);
                    // Pass the `data` payload to ContentRepository.updateDraftAware only when
                    // there are field updates — passing an empty object would still
                    // bump updated_at/version, but we want a seo-only call to touch
                    // only the SEO table. updateDraftAware delegates no-op writes to
                    // ContentRepository.update.
                    const item = hasFieldUpdates
                        ? await trxContentRepo.updateDraftAware(collection, id, { data: fields })
                        : await (async () => {
                            const existing = await trxContentRepo.findById(collection, id);
                            if (!existing)
                                throw new Error("Content not found");
                            return existing;
                        })();
                    if (hasFieldUpdates)
                        contentMutated = true;
                    const result = {
                        id: item.id,
                        type: item.type,
                        slug: item.slug,
                        status: item.status,
                        data: item.data,
                        createdAt: item.createdAt,
                        updatedAt: item.updatedAt,
                        locale: item.locale,
                        publishedAt: item.publishedAt,
                        scheduledAt: item.scheduledAt,
                    };
                    if (hasSeo) {
                        result.seo =
                            seo !== undefined
                                ? await trxSeoRepo.upsert(collection, item.id, seo)
                                : await trxSeoRepo.get(collection, item.id);
                    }
                    return result;
                });
                if (hasFieldUpdates) {
                    await markContentMediaUsageCollectionStaleSafely(db, collection, "CONTENT_USAGE_STALE");
                }
                await afterContentWrite(recordWrite);
                return updated;
            }
            catch (error) {
                if (contentMutated) {
                    await markContentMediaUsageCollectionStaleSafely(db, collection, "CONTENT_USAGE_STALE");
                }
                throw error;
            }
        },
        async delete(collection, id) {
            const recordWrite = await beforeContentWrite?.();
            const contentRepo = new ContentRepository(db);
            const deleted = await contentRepo.delete(collection, id);
            if (deleted) {
                // A trashed entry can no longer be opened, so its holder can never
                // release the lease itself. Mirrors handleContentDelete.
                await new EntryLockRepository(db).releaseEntry(collection, id);
                await markContentMediaUsageCollectionStaleSafely(db, collection, "CONTENT_USAGE_STALE");
                await afterContentWrite(recordWrite);
            }
            return deleted;
        },
    };
}
// =============================================================================
// Media Access
// =============================================================================
/**
 * Create read-only media access
 */
export function createMediaAccess(db) {
    const mediaRepo = new MediaRepository(db);
    return {
        async get(id) {
            const item = await mediaRepo.findById(id);
            return item?.status === "ready" ? toPluginMediaItem(item) : null;
        },
        async list(options) {
            const result = await mediaRepo.findMany({
                limit: options?.limit ?? 50,
                cursor: options?.cursor,
                mimeType: options?.mimeType,
            });
            return {
                items: result.items.map(toPluginMediaItem),
                cursor: result.nextCursor,
                hasMore: !!result.nextCursor,
            };
        },
    };
}
function mediaReadDenied() {
    throw new Error("Missing capability: media:read");
}
function createBlockedMediaReadAccess() {
    return {
        get: async () => mediaReadDenied(),
        list: async () => mediaReadDenied(),
    };
}
function allowedUploadType(contentType) {
    if (!CONTENT_TYPE_RE.test(contentType)) {
        throw PluginRouteError.badRequest("Invalid content type");
    }
    const mimeType = normalizeMime(contentType);
    if (!matchesMimeAllowlist(mimeType, GLOBAL_UPLOAD_ALLOWLIST)) {
        throw new PluginRouteError("UNSUPPORTED_MEDIA_TYPE", "File type not allowed", 415);
    }
    return mimeType;
}
function uploadStorageKey(filename, mimeType) {
    const keyPrefix = ulid();
    const basename = filename.split("/").pop() ?? filename;
    const dotIdx = basename.lastIndexOf(".");
    const nameExt = dotIdx > 0 ? basename.slice(dotIdx + 1).toLowerCase() : "";
    // Local storage serves files by their key's extension, so it must map to an allowed type.
    const nameType = mime.getType(nameExt);
    const nameExtAllowed = nameType !== null && matchesMimeAllowlist(nameType, GLOBAL_UPLOAD_ALLOWLIST);
    const ext = nameType === mimeType
        ? nameExt
        : (mime.getExtension(mimeType) ?? (nameExtAllowed ? nameExt : null));
    return { basename, storageKey: ext ? `${keyPrefix}.${ext}` : keyPrefix };
}
/**
 * Create full media access with write operations.
 *
 * `getUploadUrlFn` is optional: when omitted, `getUploadUrl()` is derived from
 * `storage` (create a pending record + a signed PUT URL), mirroring the REST
 * `/_emdash/api/media/upload-url` endpoint. `upload()` only needs `storage`.
 * If storage is not provided, both throw at call time.
 */
export function createMediaAccessWithWrite(db, getUploadUrlFn, storage) {
    const mediaRepo = new MediaRepository(db);
    const readAccess = createMediaAccess(db);
    const getUploadUrl = getUploadUrlFn
        ? async (filename, contentType) => getUploadUrlFn(filename, allowedUploadType(contentType))
        : async (filename, contentType) => {
            if (!storage) {
                throw new Error("Media getUploadUrl() requires a storage backend. Configure storage in PluginContextFactoryOptions.");
            }
            const mimeType = allowedUploadType(contentType);
            const { basename, storageKey } = uploadStorageKey(filename, mimeType);
            const media = await mediaRepo.createPending({
                filename: basename,
                mimeType,
                storageKey,
            });
            const signed = await storage.getSignedUploadUrl({
                key: storageKey,
                contentType: mimeType,
                expiresIn: 3600,
            });
            return { uploadUrl: signed.url, mediaId: media.id };
        };
    return {
        ...readAccess,
        getUploadUrl,
        async upload(filename, contentType, bytes) {
            if (!storage) {
                throw new Error("Media upload() requires a storage backend. Configure storage in PluginContextFactoryOptions.");
            }
            const mimeType = allowedUploadType(contentType);
            const { basename, storageKey } = uploadStorageKey(filename, mimeType);
            // Upload to storage first
            await storage.upload({
                key: storageKey,
                body: new Uint8Array(bytes),
                contentType: mimeType,
            });
            // Derive dimensions + LQIP placeholders (no-op for non-images).
            const enriched = await enrichImageMetadata(new Uint8Array(bytes), mimeType);
            // Create DB record — clean up storage on failure
            let media;
            try {
                media = await mediaRepo.create({
                    filename: basename,
                    mimeType,
                    size: bytes.byteLength,
                    storageKey,
                    status: "ready",
                    width: enriched.width,
                    height: enriched.height,
                    blurhash: enriched.blurhash,
                    dominantColor: enriched.dominantColor,
                });
            }
            catch (error) {
                try {
                    await storage.delete(storageKey);
                }
                catch {
                    // Best-effort cleanup
                }
                throw error;
            }
            return {
                mediaId: media.id,
                storageKey,
                url: `/_emdash/api/media/file/${storageKey}`,
            };
        },
        async delete(id) {
            const result = await handleMediaDelete(db, id, storage);
            if (!result.success) {
                if (result.error.code === "NOT_FOUND")
                    return false;
                throw new Error(result.error.message);
            }
            // Plugins can delete media that's referenced by site settings
            // (`logo`, `favicon`, `seo.defaultOgImage`); the worker-scoped
            // resolved-URL cache must be dropped or it will keep serving
            // 404s. Matches the invalidation in
            // `EmDashRuntime.handleMediaDelete`.
            invalidateSiteSettingsCache();
            return true;
        },
    };
}
// =============================================================================
// HTTP Access
// =============================================================================
/** Maximum number of redirects to follow in plugin HTTP access */
const MAX_PLUGIN_REDIRECTS = 5;
function stripTrailingDots(value) {
    let end = value.length;
    while (end > 0 && value.charCodeAt(end - 1) === 46)
        end--;
    return end === value.length ? value : value.slice(0, end);
}
/**
 * Check if a hostname matches any pattern in the allowed list.
 * Patterns: "*" matches all, "*.example.com" matches subdomains AND bare "example.com",
 * "api.example.com" matches exactly.
 */
function isHostAllowed(host, allowedHosts) {
    const normalizedHost = stripTrailingDots(host.toLowerCase());
    return allowedHosts.some((pattern) => {
        const normalizedPattern = stripTrailingDots(pattern.toLowerCase());
        if (normalizedPattern === "*")
            return true;
        if (normalizedPattern.startsWith("*.")) {
            const suffix = normalizedPattern.slice(1); // ".example.com"
            // Match subdomains (foo.example.com) and bare domain (example.com)
            return normalizedHost.endsWith(suffix) || normalizedHost === normalizedPattern.slice(2);
        }
        return normalizedHost === normalizedPattern;
    });
}
function tryParsePluginHttpTarget(url) {
    try {
        return new URL(url);
    }
    catch {
        return null;
    }
}
async function validatePluginHttpTarget(pluginId, url) {
    try {
        return await resolveAndValidateExternalUrl(url);
    }
    catch (error) {
        const message = error instanceof SsrfError ? error.message : "SSRF validation failed";
        const target = tryParsePluginHttpTarget(url);
        throw new Error(`Plugin "${pluginId}": blocked fetch to "${target ? target.hostname : "invalid URL"}": ${message}`, { cause: error });
    }
}
/**
 * Create HTTP access with host validation and SSRF protection.
 *
 * Uses redirect: "manual" to re-validate each redirect target before dispatch.
 */
export function createHttpAccess(pluginId, allowedHosts, fetchImpl = globalThis.fetch) {
    return {
        async fetch(url, init) {
            // Deny by default — plugins must declare allowed hosts
            if (allowedHosts.length === 0) {
                throw new Error(`Plugin "${pluginId}" has no allowed hosts configured. ` +
                    `Add hosts to the plugin's allowedHosts array to enable HTTP requests.`);
            }
            let currentUrl = url;
            let currentInit = init;
            let requestBuffered = false;
            let redirected = false;
            for (let i = 0; i <= MAX_PLUGIN_REDIRECTS; i++) {
                const target = tryParsePluginHttpTarget(currentUrl);
                if (target && !isHostAllowed(target.hostname, allowedHosts)) {
                    throw new Error(`Plugin "${pluginId}" is not allowed to fetch from host "${target.hostname}". ` +
                        `Allowed hosts: ${allowedHosts.join(", ")}`);
                }
                await validatePluginHttpTarget(pluginId, currentUrl);
                if (!requestBuffered) {
                    currentInit = await bufferPluginHttpRequest(currentInit);
                    requestBuffered = true;
                }
                const response = await fetchImpl(currentUrl, {
                    ...currentInit,
                    redirect: "manual",
                });
                const location = response.headers.get("Location");
                if (location === null) {
                    return pluginHttpResponseFromWire(await pluginHttpResponseToWire(response, currentUrl, redirected));
                }
                const redirectAction = pluginHttpRedirectAction(response.status, true, currentInit);
                if (redirectAction === "return") {
                    return pluginHttpResponseFromWire(await pluginHttpResponseToWire(response, currentUrl, redirected));
                }
                await response.body?.cancel();
                if (redirectAction === "error") {
                    throw new Error(`Plugin "${pluginId}": redirect mode is "error"`);
                }
                // Resolve relative redirects; strip credentials on cross-origin hops
                const previousOrigin = new URL(currentUrl).origin;
                currentUrl = new URL(location, currentUrl).href;
                redirected = true;
                const nextOrigin = new URL(currentUrl).origin;
                currentInit = rewritePluginHttpRedirect(response.status, currentInit);
                if (previousOrigin !== nextOrigin && currentInit) {
                    currentInit = stripCredentialHeaders(currentInit);
                }
            }
            throw new Error(`Plugin "${pluginId}": too many redirects (max ${MAX_PLUGIN_REDIRECTS})`);
        },
    };
}
/**
 * Create unrestricted HTTP access (for plugins with network:request:unrestricted capability).
 * No host validation, but applies SSRF protection on redirect targets to
 * prevent plugins from being tricked into reaching internal services.
 */
export function createUnrestrictedHttpAccess(pluginId, fetchImpl = globalThis.fetch) {
    return {
        async fetch(url, init) {
            let currentUrl = url;
            let currentInit = init;
            let requestBuffered = false;
            let redirected = false;
            for (let i = 0; i <= MAX_PLUGIN_REDIRECTS; i++) {
                await validatePluginHttpTarget(pluginId, currentUrl);
                if (!requestBuffered) {
                    currentInit = await bufferPluginHttpRequest(currentInit);
                    requestBuffered = true;
                }
                const response = await fetchImpl(currentUrl, {
                    ...currentInit,
                    redirect: "manual",
                });
                const location = response.headers.get("Location");
                if (location === null) {
                    return pluginHttpResponseFromWire(await pluginHttpResponseToWire(response, currentUrl, redirected));
                }
                const redirectAction = pluginHttpRedirectAction(response.status, true, currentInit);
                if (redirectAction === "return") {
                    return pluginHttpResponseFromWire(await pluginHttpResponseToWire(response, currentUrl, redirected));
                }
                await response.body?.cancel();
                if (redirectAction === "error") {
                    throw new Error(`Plugin "${pluginId}": redirect mode is "error"`);
                }
                // Resolve relative redirects; strip credentials on cross-origin hops
                const previousOrigin = new URL(currentUrl).origin;
                currentUrl = new URL(location, currentUrl).href;
                redirected = true;
                const nextOrigin = new URL(currentUrl).origin;
                currentInit = rewritePluginHttpRedirect(response.status, currentInit);
                if (previousOrigin !== nextOrigin && currentInit) {
                    currentInit = stripCredentialHeaders(currentInit);
                }
            }
            throw new Error(`Plugin "${pluginId}": too many redirects (max ${MAX_PLUGIN_REDIRECTS})`);
        },
    };
}
/**
 * Create blocked HTTP access (for plugins without network:request capability)
 */
export function createBlockedHttpAccess(pluginId) {
    return {
        async fetch() {
            throw new Error(`Plugin "${pluginId}" does not have the "network:request" capability. ` +
                `Add "network:request" to the plugin's capabilities to enable HTTP requests.`);
        },
    };
}
// =============================================================================
// Log Access
// =============================================================================
/**
 * Create logger for a plugin
 */
export function createLogAccess(pluginId, redactor) {
    const prefix = `[plugin:${pluginId}]`;
    const redact = (value) => redactor?.redact(value) ?? value;
    return {
        debug(message, data) {
            if (data !== undefined) {
                console.debug(prefix, redact(message), redact(data));
            }
            else {
                console.debug(prefix, redact(message));
            }
        },
        info(message, data) {
            if (data !== undefined) {
                console.info(prefix, redact(message), redact(data));
            }
            else {
                console.info(prefix, redact(message));
            }
        },
        warn(message, data) {
            if (data !== undefined) {
                console.warn(prefix, redact(message), redact(data));
            }
            else {
                console.warn(prefix, redact(message));
            }
        },
        error(message, data) {
            if (data !== undefined) {
                console.error(prefix, redact(message), redact(data));
            }
            else {
                console.error(prefix, redact(message));
            }
        },
    };
}
// =============================================================================
// Site Info
// =============================================================================
const TRAILING_SLASH_RE = /\/$/;
/**
 * Create site info from config and settings.
 *
 * Resolution order for URL:
 * 1. options table (emdash:site_url)
 * 2. Astro `site` config
 * 3. fallback to empty string
 */
export function createSiteInfo(options) {
    return {
        name: options.siteName ?? "",
        url: (options.siteUrl ?? "").replace(TRAILING_SLASH_RE, ""), // strip trailing slash
        locale: options.locale ?? "en",
        trailingSlash: options.trailingSlash ?? "ignore", // Astro's default
    };
}
/**
 * Create a URL helper that generates absolute URLs from relative paths.
 * Validates that path starts with "/" and rejects protocol-relative paths ("//").
 */
export function createUrlHelper(siteUrl) {
    const base = siteUrl.replace(TRAILING_SLASH_RE, ""); // strip trailing slash
    return (path) => {
        if (!path.startsWith("/")) {
            throw new Error(`URL path must start with "/", got: "${path}"`);
        }
        if (path.startsWith("//")) {
            throw new Error(`URL path must not be protocol-relative, got: "${path}"`);
        }
        return `${base}${path}`;
    };
}
// =============================================================================
// User Access
// =============================================================================
/**
 * Convert a UserRepository user to the plugin-facing UserInfo shape.
 * Strips sensitive fields (avatarUrl, emailVerified, data).
 */
function toUserInfo(user) {
    return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.createdAt,
    };
}
/**
 * Create read-only user access for plugins.
 * Excludes sensitive fields (password hashes, sessions, passkeys, avatar URL, data).
 */
export function createUserAccess(db) {
    const userRepo = new UserRepository(db);
    return {
        async get(id) {
            const user = await userRepo.findById(id);
            if (!user)
                return null;
            return toUserInfo(user);
        },
        async getByEmail(email) {
            const user = await userRepo.findByEmail(email);
            if (!user)
                return null;
            return toUserInfo(user);
        },
        async list(opts) {
            const result = await userRepo.findMany({
                role: opts?.role,
                cursor: opts?.cursor,
                limit: opts?.limit,
            });
            return {
                items: result.items.map(toUserInfo),
                nextCursor: result.nextCursor,
            };
        },
    };
}
/**
 * Factory for creating plugin contexts
 */
export class PluginContextFactory {
    resolveDb;
    beforeContentWrite;
    contentCreate;
    contentActions;
    storage;
    getUploadUrl;
    site;
    urlHelper;
    cronReschedule;
    now;
    emailPipeline;
    commentModerate;
    /**
     * Plugin IDs already warned about a missing media-write backend, so the
     * warning fires once per factory instead of on every hook/route context
     * creation (which would spam logs for hook-participating plugins).
     */
    warnedMissingMediaBackend = new Set();
    constructor(options) {
        const fixedDb = options.db;
        this.resolveDb = options.getDb ?? (() => fixedDb);
        this.beforeContentWrite = options.beforeContentWrite;
        this.contentCreate = options.contentCreate;
        this.contentActions = options.contentActions;
        this.storage = options.storage;
        this.getUploadUrl = options.getUploadUrl;
        this.site = createSiteInfo(options.siteInfo ?? {});
        this.urlHelper = createUrlHelper(this.site.url);
        this.cronReschedule = options.cronReschedule;
        this.now = options.now ?? (() => new Date());
        this.emailPipeline = options.emailPipeline;
        this.commentModerate = options.commentModerate;
    }
    /**
     * Create the unified plugin context
     */
    createContext(plugin) {
        const capabilities = new Set(plugin.capabilities);
        // Resolve the connection once per context. For stateless adapters this
        // is the singleton; for connection-backed adapters it's the current
        // request/event-scoped connection from ALS. All repos below are built
        // from this local `db` so a hook never queries a stale singleton socket.
        const db = this.resolveDb();
        const optionsRepo = new OptionsRepository(db);
        // Always available
        const secretRedactor = createPluginSecretRedactor();
        const settings = createSettingsAccess(optionsRepo, plugin.id, plugin.admin.settingsSchema ?? {}, undefined, secretRedactor.add);
        const kv = createKVAccess(optionsRepo, plugin.id, settings);
        const log = createLogAccess(plugin.id, secretRedactor);
        const storage = createStorageAccess(db, plugin.id, plugin.storage);
        // Capability-gated: content
        // Note: capabilities reach this point already normalized to the
        // canonical names by definePlugin / adaptSandboxEntry. Deprecated
        // names ("read:content", "write:content") never appear here.
        let content;
        if (capabilities.has("content:write")) {
            content = createContentAccessWithWrite(db, this.beforeContentWrite, {
                site: this.site,
                revisions: capabilities.has("content:revisions:read"),
            }, this.contentCreate
                ? (input) => this.contentCreate(plugin.id, input.collection, input.input, input.options)
                : undefined);
        }
        else if (capabilities.has("content:read")) {
            content = createContentAccess(db, {
                site: this.site,
                revisions: capabilities.has("content:revisions:read"),
            });
        }
        if (capabilities.has("content:publish") && this.contentActions) {
            content = Object.assign(content ?? createContentAccess(db), {
                getVersioned: (collection, id) => this.contentActions.getVersioned(plugin.id, collection, id),
                publish: (collection, id, options) => this.contentActions.publish(plugin.id, collection, id, options),
                unpublish: (collection, id, options) => this.contentActions.unpublish(plugin.id, collection, id, options),
                schedule: (collection, id, options) => this.contentActions.schedule(plugin.id, collection, id, options),
                unschedule: (collection, id, options) => this.contentActions.unschedule(plugin.id, collection, id, options),
            });
        }
        if (capabilities.has("content:restore") && this.contentActions) {
            content = Object.assign(content ?? {
                get: async () => {
                    throw new Error("Missing capability: content:read");
                },
                list: async () => {
                    throw new Error("Missing capability: content:read");
                },
            }, {
                getTrashedVersioned: (collection, id) => this.contentActions.getTrashedVersioned(plugin.id, collection, id),
                restore: (collection, id, options) => this.contentActions.restore(plugin.id, collection, id, options),
            });
        }
        const schema = capabilities.has("schema:read") ? createSchemaAccess(db) : undefined;
        // Capability-gated: taxonomies
        let taxonomies;
        if (capabilities.has("taxonomies:write")) {
            taxonomies = createTaxonomyAccessWithWrite(db);
        }
        else if (capabilities.has("taxonomies:read")) {
            taxonomies = createTaxonomyAccess(db);
        }
        const bylines = capabilities.has("bylines:read") ? createBylineAccess(db) : undefined;
        let redirects;
        if (capabilities.has("redirects:write")) {
            redirects = createRedirectAccess(db, true);
        }
        else if (capabilities.has("redirects:read")) {
            redirects = createRedirectAccess(db);
        }
        // Capability-gated: media
        // `upload()` only needs `storage`; `getUploadUrl()` is derived from
        // storage when no explicit provider is wired. Granting write access on
        // either avoids silently degrading media:write to read-only — the bug
        // where the runtime threads `storage` but not `getUploadUrl`.
        let media;
        const hasMediaAccess = capabilities.has("media:read") ||
            capabilities.has("media:write") ||
            capabilities.has("media:bytes:read") ||
            capabilities.has("media:metadata:write");
        if (hasMediaAccess) {
            media =
                capabilities.has("media:read") || capabilities.has("media:write")
                    ? createMediaAccess(db)
                    : createBlockedMediaReadAccess();
        }
        if (capabilities.has("media:write")) {
            if (this.getUploadUrl || this.storage) {
                media = createMediaAccessWithWrite(db, this.getUploadUrl, this.storage);
            }
            else {
                if (!this.warnedMissingMediaBackend.has(plugin.id)) {
                    this.warnedMissingMediaBackend.add(plugin.id);
                    log.warn("declares the media:write capability but no storage backend is configured; upload() is unavailable.");
                }
                media ??= createMediaAccess(db);
            }
        }
        if (capabilities.has("media:bytes:read") && media) {
            media.readBytes = (id, options) => readPluginMediaBytes(db, this.storage, id, options);
        }
        if (capabilities.has("media:metadata:write") && media) {
            media.updateMetadata = (id, patch) => updatePluginMediaMetadata(db, id, patch);
        }
        // Capability-gated: http
        let http;
        if (capabilities.has("network:request:unrestricted")) {
            http = createUnrestrictedHttpAccess(plugin.id);
        }
        else if (capabilities.has("network:request")) {
            http = createHttpAccess(plugin.id, plugin.allowedHosts);
        }
        // Capability-gated: users
        let users;
        if (capabilities.has("users:read")) {
            users = createUserAccess(db);
        }
        let comments;
        if (capabilities.has("comments:moderate")) {
            comments = createCommentAccess(db, (id, status, expectedStatus) => {
                if (!this.commentModerate)
                    throw new Error("Comment moderation is unavailable");
                return this.commentModerate(plugin.id, id, status, expectedStatus);
            });
        }
        else if (capabilities.has("comments:read")) {
            comments = createCommentAccess(db);
        }
        // Cron access — always available (scoped to plugin), but only if
        // the runtime provided a reschedule callback (i.e. cron is wired up).
        let cron;
        if (this.cronReschedule) {
            cron = new CronAccessImpl(db, plugin.id, this.cronReschedule, this.now);
        }
        // Email access — requires email:send capability AND a configured provider
        let email;
        if (capabilities.has("email:send") && this.emailPipeline?.isAvailable()) {
            const pipeline = this.emailPipeline;
            const pluginId = plugin.id;
            email = {
                send: (message) => pipeline.send(message, pluginId),
            };
        }
        return {
            plugin: {
                id: plugin.id,
                version: plugin.version,
            },
            storage,
            kv,
            settings,
            content,
            schema,
            taxonomies,
            bylines,
            redirects,
            media,
            http,
            log,
            site: this.site,
            url: this.urlHelper,
            users,
            comments,
            cron,
            email,
        };
    }
}
/**
 * Create a plugin context for a resolved plugin
 */
export function createPluginContext(options, plugin) {
    const factory = new PluginContextFactory(options);
    return factory.createContext(plugin);
}
