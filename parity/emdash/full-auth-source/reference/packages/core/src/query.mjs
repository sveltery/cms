/// <reference types="astro/client" />
/**
 * Query functions for EmDash content
 *
 * These wrap Astro's getLiveCollection/getLiveEntry with type filtering.
 * Use these instead of calling Astro's functions directly.
 *
 * Error handling follows Astro's pattern - returns { entries/entry, error }
 * so callers can gracefully handle errors (including 404s).
 *
 * Preview mode is handled implicitly via ALS request context —
 * no parameters needed. The middleware verifies the preview token
 * and sets the context; query functions read it automatically.
 *
 * The triple-slash directive above pulls in the ambient declaration for
 * `astro:content` (used by the dynamic imports below) so this source
 * file typechecks even when reached transitively by a sibling package
 * whose tsconfig doesn't list `astro/client` in `compilerOptions.types`.
 *
 * Note: the directive is stripped from the compiled output (`dist/*`)
 * by tsdown, so it does not propagate to downstream consumers of the
 * published package. Consumers are Astro sites and already provide their
 * own `astro/client` ambient surface anyway, so the runtime dynamic
 * import resolves there at typecheck time without our help.
 */
import { getFallbackChain, getI18nConfig, isI18nEnabled } from "./i18n/config.js";
import { creditsFromFoldedBylines, CURSOR_RAW_VALUES, encodeSortCursor, FOLDED_BYLINES, FOLDED_BYLINES_EXIST, FOLDED_TERMS, loadPublishedDates, } from "./loader.js";
import { cachedQuery, contentCacheNamespaces, contentNamespaces, invalidateSchemaObjectCache, } from "./object-cache/index.js";
import { primeSeoPanel } from "./page/seo-panel.js";
import { requestCached } from "./request-cache.js";
import { getRequestContext } from "./request-context.js";
import { resetRegisteredCollectionsCache } from "./schema/collection-slugs-cache.js";
import { compileUrlPattern } from "./schema/url-pattern.js";
import { isMissingColumnError, isMissingTableError } from "./utils/db-errors.js";
import { createEditable, createNoop, } from "./visual-editing/editable.js";
/** @internal Publication dates for the Archives widget. */
export async function getPublishedDates(type, options) {
    const locale = effectiveLocaleKey(options) || undefined;
    const key = `publishedDates:${JSON.stringify([type, locale])}`;
    try {
        return await requestCached(key, () => cachedQuery({
            namespace: contentCacheNamespaces(type),
            key,
            load: async () => {
                const rows = await loadPublishedDates(type, locale);
                const dates = [];
                let lastModified;
                for (const row of rows) {
                    if (row.published_at) {
                        const date = new Date(row.published_at);
                        if (!Number.isNaN(date.getTime()))
                            dates.push(date);
                    }
                    if (row.updated_at) {
                        const modified = new Date(row.updated_at);
                        if (!Number.isNaN(modified.getTime()) && (!lastModified || modified > lastModified)) {
                            lastModified = modified;
                        }
                    }
                }
                return { dates, cacheHint: { tags: [type], lastModified } };
            },
        }));
    }
    catch (error) {
        return {
            dates: [],
            cacheHint: {},
            error: isMissingTableError(error) || isMissingColumnError(error)
                ? undefined
                : error instanceof Error
                    ? error
                    : new Error("Failed to load publication dates"),
        };
    }
}
const COLLECTION_NAME = "_emdash";
/** Symbol key for edit metadata on PT arrays — avoids collision with user data */
const EMDASH_EDIT = Symbol.for("__emdash");
/** Type guard for EditFieldMeta */
function isEditFieldMeta(value) {
    if (typeof value !== "object" || value === null)
        return false;
    if (!("collection" in value) || !("id" in value) || !("field" in value))
        return false;
    // After `in` checks, TS narrows to Record<"collection" | "id" | "field", unknown>
    const { collection, id, field } = value;
    return typeof collection === "string" && typeof id === "string" && typeof field === "string";
}
/**
 * Read edit metadata from a value (returns undefined if not tagged).
 * Uses Object.getOwnPropertyDescriptor to access Symbol-keyed property
 * without an unsafe type assertion.
 */
export function getEditMeta(value) {
    if (value && typeof value === "object") {
        const desc = Object.getOwnPropertyDescriptor(value, EMDASH_EDIT);
        const meta = desc?.value;
        if (isEditFieldMeta(meta)) {
            return meta;
        }
    }
    return undefined;
}
/**
 * Tag PT-like arrays in entry data with edit metadata (non-enumerable).
 * A PT array is identified by: is an array, first element has _type property.
 */
function tagEditableFields(data, collection, id) {
    for (const [field, value] of Object.entries(data)) {
        if (Array.isArray(value) &&
            value.length > 0 &&
            value[0] &&
            typeof value[0] === "object" &&
            "_type" in value[0]) {
            Object.defineProperty(value, EMDASH_EDIT, {
                value: { collection, id, field },
                enumerable: false,
                configurable: true,
            });
        }
    }
}
/** Safely read a string field from a Record, with optional fallback */
function dataStr(data, key, fallback = "") {
    const val = data[key];
    return typeof val === "string" ? val : fallback;
}
/** Type guard for Record<string, unknown> */
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
/** Extract data as Record from an Astro entry (which is any-typed) */
function entryData(entry) {
    return isRecord(entry.data) ? entry.data : {};
}
/** Extract the database ID from entry data (data.id is the ULID, entry.id is the slug) */
function entryDatabaseId(entry) {
    const d = entryData(entry);
    return dataStr(d, "id") || entry.id;
}
/** Extract edit options from entry data for the proxy */
function entryEditOptions(entry) {
    const data = entryData(entry);
    const status = dataStr(data, "status", "draft");
    const draftRevisionId = dataStr(data, "draftRevisionId") || undefined;
    const liveRevisionId = dataStr(data, "liveRevisionId") || undefined;
    const hasDraft = !!draftRevisionId && draftRevisionId !== liveRevisionId;
    return { status, hasDraft };
}
function stripRevisionMetadata(entry) {
    const data = entryData(entry);
    delete data.draftRevisionId;
    delete data.liveRevisionId;
}
function canExposeRevisionMetadata(entry, collection) {
    const ctx = getRequestContext();
    if (ctx?.editMode)
        return true;
    if (ctx?.preview?.collection !== collection)
        return false;
    const dbId = entryDatabaseId(entry);
    return ctx.preview.id === dbId || ctx.preview.id === entry.id;
}
/**
 * Get all entries of a content type
 *
 * Returns { entries, error } for graceful error handling.
 *
 * When emdash-env.d.ts is generated, the collection name will be
 * type-checked and the return type will be inferred automatically.
 *
 * @example
 * ```ts
 * import { getEmDashCollection } from "emdash";
 *
 * const { entries: posts, error } = await getEmDashCollection("posts");
 * if (error) {
 *   console.error("Failed to load posts:", error);
 *   return;
 * }
 * // posts[0].data.title is typed (if emdash-env.d.ts exists)
 *
 * // With filters
 * const { entries: drafts } = await getEmDashCollection("posts", { status: "draft" });
 * ```
 */
export async function getEmDashCollection(type, filter) {
    // Cache per (type, filter) within a single request. Edit mode and
    // preview are request-scoped and stable, so they don't need to be
    // part of the key. Widgets and layouts frequently request the same
    // collection shape as the page itself (e.g. a "recent posts" list
    // appears on the home page AND in the sidebar) — caching collapses
    // those duplicate queries, along with the bylines and taxonomy-term
    // hydration each call would otherwise re-do.
    //
    // Bucket small limits to a shared minimum so a page with several
    // "recent N posts" widgets at slightly different limits (e.g. a
    // post-detail page asking for 4 in the body and 5 in the sidebar)
    // shares one fetch + hydration round-trip rather than running two.
    // Cursor-paginated calls are exempt: their limit is part of the
    // pagination contract.
    const bucketed = bucketFilter(filter);
    // Preview and edit-mode requests skip `loadCollectionCached`. That path
    // reduces every entry to a JSON snapshot (`entrySnapshot`) and rebuilds it
    // with `reviveEntry`, which cannot carry the `edit` proxy and re-attaches
    // the no-op — so annotations spread as `{...entry.edit.title}` would render
    // nothing on list pages. `getEmDashEntry` has the same bypass for the same
    // reason (see its `serveDrafts` branch). The request-scoped cache still
    // collapses duplicate queries within the render.
    const ctx = getRequestContext();
    const serveDrafts = ctx?.editMode === true || ctx?.preview !== undefined;
    const cached = await requestCached(collectionCacheKey(type, bucketed.fetchFilter), () => serveDrafts
        ? getEmDashCollectionUncached(type, bucketed.fetchFilter)
        : loadCollectionCached(type, bucketed.fetchFilter));
    return bucketed.requestedLimit === undefined
        ? cached
        : sliceCollectionResult(cached, bucketed.requestedLimit, filter?.orderBy);
}
/**
 * Distributed (L2) read-through around {@link getEmDashCollectionUncached}.
 *
 * Caches a JSON-safe snapshot keyed by collection + filter + effective locale,
 * folding the shared `bylines`/`taxonomies` epochs into the key so renaming an
 * author or term invalidates affected lists. Errors are never cached.
 */
async function loadCollectionCached(type, filter) {
    const snapshot = await cachedQuery({
        namespace: contentNamespaces(type),
        key: `collection:${collectionCacheKey(type, filter)}|loc=${effectiveLocaleKey(filter)}`,
        load: async () => {
            const result = await getEmDashCollectionUncached(type, filter);
            if (result.error) {
                return { ok: false, error: result.error, cacheHint: result.cacheHint };
            }
            return {
                ok: true,
                value: {
                    entries: result.entries.map(entrySnapshot),
                    nextCursor: result.nextCursor,
                    hasMore: result.hasMore,
                    cacheHint: result.cacheHint,
                },
            };
        },
        cacheable: (snap) => snap.ok,
    });
    if (!snapshot.ok) {
        return { entries: [], error: snapshot.error, cacheHint: snapshot.cacheHint };
    }
    return {
        entries: snapshot.value.entries.map((entry) => {
            const revived = reviveEntry(entry);
            if (!canExposeRevisionMetadata(revived, type))
                stripRevisionMetadata(revived);
            return revived;
        }),
        nextCursor: snapshot.value.nextCursor,
        hasMore: snapshot.value.hasMore,
        cacheHint: snapshot.value.cacheHint,
    };
}
/**
 * Threshold for limit bucketing. Page templates routinely render small
 * "recent posts" widgets at limits 3-8; rounding those up to a single
 * shared bucket lets one fetch satisfy several widgets within a request.
 * Above this, the requested limit is honoured exactly — bucketing limit:50
 * to limit:64 would waste hydration work for callers fetching real pages.
 */
const BUCKET_LIMIT_THRESHOLD = 10;
/** @internal exported for unit tests; not part of the public API. */
export function bucketFilter(filter) {
    const limit = filter?.limit;
    if (limit === undefined ||
        limit >= BUCKET_LIMIT_THRESHOLD ||
        limit <= 0 ||
        filter?.cursor !== undefined ||
        // Offset paginates a deliberate page window; its limit is part of the
        // pagination contract, so don't round it up the way "recent N" widgets get.
        filter?.offset !== undefined) {
        return { fetchFilter: filter, requestedLimit: undefined };
    }
    return {
        fetchFilter: { ...filter, limit: BUCKET_LIMIT_THRESHOLD },
        requestedLimit: limit,
    };
}
/**
 * Slice a cached bucketed result down to the originally-requested limit
 * and recompute `nextCursor` from the row that would have been the
 * over-fetch detector for that limit. When truncation is needed, returns
 * a shallow-copied result with a new `entries` array; otherwise returns
 * the cached result unchanged (including error results and results
 * already within the requested limit).
 */
/** @internal exported for unit tests; not part of the public API. */
export function sliceCollectionResult(cached, limit, orderBy) {
    if (cached.error)
        return cached;
    if (cached.entries.length <= limit)
        return cached;
    const sliced = cached.entries.slice(0, limit);
    // Mirror the loader's encoding: cursor points at the last returned row,
    // so "next page" picks up at the row immediately after it. See
    // buildCursorCondition in loader.ts — it filters strictly past this row.
    const lastEntry = sliced.at(-1);
    const nextCursor = lastEntry ? encodeEntryCursor(lastEntry, orderBy) : undefined;
    // Truncating to the requested limit means at least one more entry existed.
    return { ...cached, entries: sliced, nextCursor, hasMore: true };
}
/** Map of database column names to camelCase keys present on entry.data. */
const ENTRY_DATA_KEY_MAP = {
    created_at: "createdAt",
    updated_at: "updatedAt",
    published_at: "publishedAt",
    scheduled_at: "scheduledAt",
    author_id: "authorId",
    primary_byline_id: "primaryBylineId",
};
// Mirror loader.ts FIELD_NAME_PATTERN. Kept in sync intentionally — diverging
// would let the encoder accept a field name the loader's getPrimarySort then
// rejected, producing a cursor that paginates against a different column.
const FIELD_NAME_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
/**
 * Encode a `nextCursor` from a content entry, as the loader encodes one from
 * the entry's row. Reads the sort column's raw DB value the loader stashed via
 * CURSOR_RAW_VALUES, since `entry.data` can't reproduce it for every column.
 */
function encodeEntryCursor(entry, orderBy) {
    const data = entryData(entry);
    const id = dataStr(data, "id");
    if (!id)
        return undefined;
    // Match loader.ts getPrimarySort: take the first valid field, default to created_at.
    let dbField = "created_at";
    if (orderBy) {
        for (const field of Object.keys(orderBy)) {
            if (FIELD_NAME_PATTERN.test(field)) {
                dbField = field;
                break;
            }
        }
    }
    const rawValues = Reflect.get(data, CURSOR_RAW_VALUES);
    if (rawValues !== null && typeof rawValues === "object" && Object.hasOwn(rawValues, dbField)) {
        return encodeSortCursor(dbField, Reflect.get(rawValues, dbField), id);
    }
    // Entries from a cache snapshot written by an earlier version have no stashed sort value.
    return encodeSortCursor(dbField, data[ENTRY_DATA_KEY_MAP[dbField] ?? dbField], id);
}
/**
 * Build a canonical cache key for `getEmDashCollection`.
 *
 * `JSON.stringify` is insertion-order-sensitive, so two callers passing
 * semantically identical filters with different key orders would miss
 * the cache. We fix the top-level field order and sort `where` keys
 * (order there is irrelevant), while preserving `orderBy` key order
 * because that's the sort priority.
 */
function collectionCacheKey(type, filter) {
    if (!filter)
        return `collection:${type}:`;
    const parts = [
        filter.status ?? "",
        filter.limit ?? "",
        filter.cursor ?? "",
        filter.offset ?? "",
        filter.where ? stableStringify(filter.where) : "",
        filter.orderBy ? JSON.stringify(filter.orderBy) : "",
        filter.locale ?? "",
    ];
    return `collection:${type}:${parts.join("|")}`;
}
function stableStringify(value) {
    return JSON.stringify(stableOrder(value));
}
function stableOrder(value) {
    const keys = Object.keys(value).toSorted();
    const ordered = {};
    for (const k of keys) {
        const v = value[k];
        if (isRecord(v)) {
            ordered[k] = stableOrder(v);
        }
        else {
            ordered[k] = v;
        }
    }
    return ordered;
}
// ── Object-cache (L2) serialization for content reads ───────────────────────
//
// Content entries can't be stored verbatim: each carries a non-serializable
// `edit` proxy (a function) and a non-enumerable `CURSOR_RAW_VALUES` symbol on
// `data` (raw date strings used to reproduce the loader's pagination cursor).
// We reduce each entry to a JSON-safe snapshot before caching — copying the
// cursor-raw values into an enumerable field and dropping `edit` — then rebuild
// the symbol and re-attach a no-op `edit` on the way out. The object cache's
// codec preserves `Date` instances, so timestamps survive the round-trip.
//
// L2 is only consulted for anonymous, non-preview, non-edit requests (see
// `shouldBypass` in object-cache), where `edit` is always the no-op variant —
// so dropping and recreating it is lossless.
/** Enumerable field carrying the {@link CURSOR_RAW_VALUES} payload in snapshots. */
const CURSOR_RAW_FIELD = "__emdashCursorRaw";
function dataSnapshot(data) {
    const rawCursor = Reflect.get(data, CURSOR_RAW_VALUES);
    return { ...data, [CURSOR_RAW_FIELD]: rawCursor ?? {} };
}
function reviveData(raw) {
    const data = { ...raw };
    // eslint-disable-next-line typescript/no-unsafe-type-assertion -- snapshot field written by dataSnapshot
    const rawCursor = data[CURSOR_RAW_FIELD] ?? {};
    delete data[CURSOR_RAW_FIELD];
    Object.defineProperty(data, CURSOR_RAW_VALUES, {
        value: rawCursor,
        enumerable: false,
        configurable: false,
        writable: false,
    });
    return data;
}
function entrySnapshot(entry) {
    // Drop the `edit` function; copy enumerable data + the cursor-raw values.
    const { edit: _edit, references, ...rest } = entry;
    return {
        ...rest,
        data: dataSnapshot(entryData(entry)),
        ...(references ? { references: referencesSnapshot(references) } : {}),
    };
}
function referencesSnapshot(references) {
    const snapshot = {};
    for (const [field, page] of Object.entries(references)) {
        snapshot[field] = {
            entries: page.entries.map((child) => ({
                id: child.id,
                data: dataSnapshot(entryData(child)),
            })),
            ...(page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor }),
        };
    }
    return snapshot;
}
/**
 * Rebuild the reference pages a snapshot carried.
 *
 * Every child comes back with a no-op `edit` proxy and no revision metadata,
 * which is lossless: the object cache is bypassed for edit-mode and preview
 * requests, so a snapshot is only ever written — and read back — by a render
 * that had neither to begin with.
 */
function reviveReferences(raw) {
    if (!isRecord(raw))
        return undefined;
    const references = {};
    for (const [field, page] of Object.entries(raw)) {
        // eslint-disable-next-line typescript/no-unsafe-type-assertion -- page shape produced by referencesSnapshot
        const snapshot = page;
        references[field] = {
            entries: snapshot.entries.map((child) => ({
                // eslint-disable-next-line typescript/no-unsafe-type-assertion -- snapshot ids are always strings
                id: child.id,
                // eslint-disable-next-line typescript/no-unsafe-type-assertion -- snapshot `data` is always a record
                data: reviveData(child.data),
                edit: createNoop(),
            })),
            ...(snapshot.nextCursor === undefined ? {} : { nextCursor: snapshot.nextCursor }),
        };
    }
    return references;
}
function reviveEntry(raw) {
    // eslint-disable-next-line typescript/no-unsafe-type-assertion -- snapshot shape produced by entrySnapshot
    const entry = raw;
    // eslint-disable-next-line typescript/no-unsafe-type-assertion -- snapshot `data` is always a record
    const data = reviveData(entry.data);
    const references = reviveReferences(entry.references);
    const revived = {
        ...entry,
        data,
        ...(references ? { references } : {}),
        edit: createNoop(),
    };
    // eslint-disable-next-line typescript/no-unsafe-type-assertion -- rebuilt to the ContentEntry shape with a no-op edit proxy
    return revived;
}
/** Resolve the effective locale used by content reads, for the L2 cache key. */
function effectiveLocaleKey(filter) {
    const ctx = getRequestContext();
    const i18nConfig = getI18nConfig();
    return (filter?.locale ?? ctx?.locale ?? (isI18nEnabled() ? i18nConfig.defaultLocale : undefined) ?? "");
}
async function getEmDashCollectionUncached(type, filter) {
    // Dynamic import to avoid build-time issues
    const { getLiveCollection } = await import("astro:content");
    // Resolve locale: explicit filter > ALS context > defaultLocale (when i18n enabled)
    // Without this, queries return all locale rows, producing broken IDs
    const ctx = getRequestContext();
    const i18nConfig = getI18nConfig();
    const resolvedLocale = filter?.locale ?? ctx?.locale ?? (isI18nEnabled() ? i18nConfig.defaultLocale : undefined);
    const requestedLimit = filter?.limit;
    // cursor and offset are mutually exclusive on the loader filter union, so
    // spread only the one in play (cursor wins) rather than emitting both keys.
    const pageParam = filter?.cursor !== undefined
        ? { cursor: filter.cursor }
        : filter?.offset !== undefined
            ? { offset: filter.offset }
            : {};
    const result = await getLiveCollection(COLLECTION_NAME, {
        type,
        status: filter?.status,
        limit: requestedLimit && requestedLimit > 0 ? requestedLimit + 1 : filter?.limit,
        ...pageParam,
        where: filter?.where,
        orderBy: filter?.orderBy,
        locale: resolvedLocale,
    });
    const { entries, error, cacheHint } = result;
    if (error) {
        return { entries: [], error, cacheHint: {} };
    }
    const hasMore = requestedLimit != null && requestedLimit > 0 && entries.length > requestedLimit;
    const pageEntries = hasMore ? entries.slice(0, requestedLimit) : entries;
    const nextCursor = hasMore ? encodeEntryCursor(pageEntries.at(-1), filter?.orderBy) : undefined;
    // `hasMore` is only meaningful when a limit bounds the page; otherwise the
    // query returned everything and there is no "next page" to report.
    const hasMoreResult = requestedLimit != null && requestedLimit > 0 ? hasMore : undefined;
    const isEditMode = ctx?.editMode ?? false;
    const entriesWithEdit = pageEntries.map((entry) => {
        const dbId = entryDatabaseId(entry);
        if (isEditMode) {
            tagEditableFields(entryData(entry), type, dbId);
        }
        if (!canExposeRevisionMetadata(entry, type)) {
            stripRevisionMetadata(entry);
        }
        return {
            ...entry,
            edit: isEditMode ? createEditable(type, dbId, entryEditOptions(entry)) : createNoop(),
        };
    });
    // Eagerly hydrate bylines and taxonomy terms for all entries in parallel.
    // Both are independent queries, so running them concurrently halves the
    // round-trip cost on remote databases (D1 replicas, etc.).
    await Promise.all([
        hydrateEntryBylines(type, entriesWithEdit),
        // Use the content query locale as the preferred term locale; hydration
        // falls back only to the configured default when a group lacks that variant.
        hydrateEntryTerms(type, entriesWithEdit, resolvedLocale),
    ]);
    return {
        entries: entriesWithEdit,
        nextCursor,
        hasMore: hasMoreResult,
        cacheHint: cacheHint ?? {},
    };
}
/**
 * Get a single entry by type and ID/slug
 *
 * Returns { entry, error, isPreview } for graceful error handling.
 * - entry is null if not found (not an error)
 * - error is set only for actual errors (db issues, etc.)
 *
 * Preview mode is detected automatically from request context (ALS).
 * When the URL has a valid `_preview` token, the middleware sets preview
 * context and this function serves draft revision data if available.
 *
 * @example
 * ```ts
 * import { getEmDashEntry } from "emdash";
 *
 * // Simple usage — preview just works via middleware
 * const { entry: post, isPreview, error } = await getEmDashEntry("posts", "my-slug");
 * if (!post) return Astro.rewrite("/404");
 * ```
 *
 * @example
 * ```ts
 * // Opt into reference fields, by field slug
 * const { entry: post } = await getEmDashEntry("posts", slug, {
 *   references: { author: true, related_posts: { limit: 6 } },
 * });
 * const author = post?.references?.author.entries[0];
 * ```
 */
export async function getEmDashEntry(type, id, options) {
    // eslint-disable-next-line typescript/no-unsafe-type-assertion -- the resolver returns one page per field the selection named, which is what SelectedReferences picks out
    return resolveEmDashEntry(type, id, options);
}
/**
 * Attach one page of each selected reference field to a resolved entry, and
 * report the cache hint its children contribute.
 *
 * An entry with no translation group predates i18n and has no links; there is
 * nothing to resolve, and `references` stays absent rather than becoming an
 * empty object that reads as "this entry references nothing".
 */
async function attachReferences(type, entry, options) {
    const data = entryData(entry);
    const entryGroup = dataStr(data, "translationGroup");
    if (!entryGroup)
        return {};
    const { resolveReferencePages } = await import("./references/resolve.js");
    const pages = await resolveReferencePages({
        collection: type,
        entryGroup,
        locale: dataStr(data, "locale") || null,
        draftRevisionId: options.draftRevisionId,
        serveDrafts: options.serveDrafts,
        selection: options.selection,
    });
    const references = {};
    const tags = [];
    let lastModified;
    for (const [field, page] of Object.entries(pages)) {
        for (const child of page.entries) {
            tags.push(...child.cacheHint.tags);
            const modified = child.cacheHint.lastModified;
            if (modified && (!lastModified || modified > lastModified))
                lastModified = modified;
        }
        references[field] = {
            entries: page.entries.map((child) => wrapReferencedEntry(page.collection, child)),
            ...(page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor }),
        };
    }
    entry.references = references;
    return { tags, ...(lastModified ? { lastModified } : {}) };
}
/**
 * Fold the children's cache hint into the entry's own.
 *
 * A render that shows a referenced entry has read that row, so the route's tags
 * have to name it and its `Last-Modified` has to move when it changes. Without
 * this the route cache's `invalidate({ tags: [collection, id] })` on a child
 * write would never reach the pages that render the child.
 */
function mergeCacheHints(base, extra) {
    if (!extra.tags?.length && !extra.lastModified)
        return base;
    const tags = [...new Set([...(base.tags ?? []), ...(extra.tags ?? [])])];
    const newest = base.lastModified && extra.lastModified
        ? base.lastModified > extra.lastModified
            ? base.lastModified
            : extra.lastModified
        : (base.lastModified ?? extra.lastModified);
    return {
        ...(tags.length > 0 ? { tags } : {}),
        ...(newest ? { lastModified: newest } : {}),
    };
}
/**
 * The object-cache namespaces a selection's targets live in.
 *
 * Without them a cached parent snapshot would outlive a write to the entries it
 * points at. Byline and taxonomy namespaces are deliberately absent: referenced
 * entries are loaded without either hydration. The targets are sorted so two
 * callers that name the same fields in a different order share one snapshot.
 */
async function referenceTargetNamespaces(collection, selection) {
    const { getReferenceFieldMap } = await import("./references/field-map.js");
    const fieldMap = await getReferenceFieldMap(collection);
    const targets = new Set();
    for (const [slug, query] of Object.entries(selection)) {
        if (query === undefined)
            continue;
        const binding = fieldMap.get(slug);
        if (binding)
            targets.add(binding.targetCollection);
    }
    return [...targets].toSorted().flatMap((target) => [...contentCacheNamespaces(target)]);
}
/**
 * Wrap a referenced entry the way the collection paths wrap their own: an edit
 * proxy in edit mode, revision metadata stripped for anyone who may not see it.
 *
 * The proxy is scoped to the *referenced* entry's collection and row, so
 * clicking through from a card opens the entry the card is about.
 */
function wrapReferencedEntry(collection, child) {
    const isEditMode = getRequestContext()?.editMode ?? false;
    const dbId = entryDatabaseId(child);
    if (isEditMode)
        tagEditableFields(child.data, collection, dbId);
    if (!canExposeRevisionMetadata(child, collection))
        stripRevisionMetadata(child);
    return {
        id: child.id,
        // eslint-disable-next-line typescript/no-unsafe-type-assertion -- row data is shaped by the target collection, which only generated types know
        data: child.data,
        edit: isEditMode ? createEditable(collection, dbId, entryEditOptions(child)) : createNoop(),
    };
}
async function resolveEmDashEntry(type, id, options) {
    // Dynamic import to avoid build-time issues
    const { getLiveEntry } = await import("astro:content");
    // Check ALS for preview and edit mode context
    const ctx = getRequestContext();
    const preview = ctx?.preview;
    const isEditMode = ctx?.editMode ?? false;
    const isPreviewMode = !!preview && preview.collection === type;
    // Edit mode implies preview — editors should see draft content
    const serveDrafts = isPreviewMode || isEditMode;
    // Resolve locale: explicit option > ALS context > undefined (no filter)
    const requestedLocale = options?.locale ?? ctx?.locale;
    const references = options?.references;
    /** Wrap a raw Astro entry with edit proxy, tagging editable fields if needed */
    function wrapEntry(raw) {
        const dbId = entryDatabaseId(raw);
        if (isEditMode) {
            tagEditableFields(entryData(raw), type, dbId);
        }
        return {
            ...raw,
            edit: isEditMode ? createEditable(type, dbId, entryEditOptions(raw)) : createNoop(),
        };
    }
    /** Check if an entry has completed publication. */
    function isVisible(entry) {
        return dataStr(entryData(entry), "status") === "published";
    }
    // Build the fallback chain: [requestedLocale, fallback1, ..., defaultLocale]
    // When i18n is disabled or no locale requested, just use a single-element chain
    const localeChain = requestedLocale && isI18nEnabled() ? getFallbackChain(requestedLocale) : [requestedLocale];
    /** Return a successful EntryResult with bylines, taxonomy terms and references hydrated */
    async function successResult(wrapped, opts) {
        // Read the draft pointer before stripping it: a public render drops it
        // from `data`, and a staged selection is resolved from it.
        const draftRevisionId = dataStr(entryData(wrapped), "draftRevisionId") || undefined;
        if (!opts.isPreview)
            stripRevisionMetadata(wrapped);
        // No-i18n callers use the legacy wildcard cache key. The query path still
        // resolves against the stored content-row locale when this is undefined.
        const termLocale = isI18nEnabled()
            ? dataStr(entryData(wrapped), "locale") || undefined
            : undefined;
        // References resolve alongside bylines and terms rather than after the
        // entry returns: all three are independent reads, and running them
        // together keeps an opted-in render to one extra round of queries.
        const [, , referenceHint] = await Promise.all([
            hydrateEntryBylines(type, [wrapped]),
            hydrateEntryTerms(type, [wrapped], termLocale),
            references
                ? attachReferences(type, wrapped, {
                    selection: references,
                    serveDrafts: opts.isPreview,
                    draftRevisionId,
                })
                : Promise.resolve({}),
        ]);
        return {
            entry: wrapped,
            isPreview: opts.isPreview,
            fallbackLocale: opts.fallbackLocale,
            cacheHint: mergeCacheHints(opts.cacheHint, referenceHint),
        };
    }
    if (serveDrafts) {
        // Draft mode: try each locale in the fallback chain
        for (let i = 0; i < localeChain.length; i++) {
            const locale = localeChain[i];
            const fallbackLocale = i > 0 ? locale : undefined;
            const { entry: baseEntry, error: baseError, cacheHint, } = await getLiveEntry(COLLECTION_NAME, {
                type,
                id,
                locale,
            });
            if (baseError) {
                // Astro reports a missing entry as an error; try the next locale.
                if (baseError.name === "LiveEntryNotFoundError")
                    continue;
                return { entry: null, error: baseError, isPreview: serveDrafts, cacheHint: {} };
            }
            if (!baseEntry)
                continue; // Try next locale in chain
            // Preview tokens are item-scoped: verify the resolved entry matches.
            // Edit mode (authenticated editors) has collection-wide draft access.
            if (isPreviewMode && !isEditMode) {
                const dbId = entryDatabaseId(baseEntry);
                if (preview.id !== dbId && preview.id !== id) {
                    // Token doesn't match — serve only if publicly visible, without draft access
                    if (isVisible(baseEntry)) {
                        return successResult(wrapEntry(baseEntry), {
                            isPreview: false,
                            fallbackLocale,
                            cacheHint: cacheHint ?? {},
                        });
                    }
                    // Not visible — try next locale in fallback chain
                    continue;
                }
            }
            // Check if entry has a draft revision — if so, re-fetch with revision data
            const baseData = entryData(baseEntry);
            const draftRevisionId = dataStr(baseData, "draftRevisionId") || undefined;
            if (draftRevisionId) {
                const { entry: draftEntry, error: draftError } = await getLiveEntry(COLLECTION_NAME, {
                    type,
                    id,
                    revisionId: draftRevisionId,
                    locale,
                });
                if (!draftError && draftEntry) {
                    return successResult(wrapEntry(draftEntry), {
                        isPreview: serveDrafts,
                        fallbackLocale,
                        cacheHint: cacheHint ?? {},
                    });
                }
            }
            return successResult(wrapEntry(baseEntry), {
                isPreview: serveDrafts,
                fallbackLocale,
                cacheHint: cacheHint ?? {},
            });
        }
        // No entry found in any locale
        return { entry: null, isPreview: serveDrafts, cacheHint: {} };
    }
    // Normal mode: try each locale in the fallback chain, only return published
    // content. The full resolution (fallback chain + visibility + byline/term
    // hydration) is wrapped in the distributed L2 cache, keyed by the requested
    // locale. Preview/edit requests took the `serveDrafts` branch above and
    // never reach here; the object cache additionally bypasses them.
    const resolveNormal = async () => {
        for (let i = 0; i < localeChain.length; i++) {
            const locale = localeChain[i];
            const fallbackLocale = i > 0 ? locale : undefined;
            const { entry, error, cacheHint } = await getLiveEntry(COLLECTION_NAME, { type, id, locale });
            if (error) {
                // Astro reports a missing entry as an error; try the next locale.
                if (error.name === "LiveEntryNotFoundError")
                    continue;
                return { entry: null, error, isPreview: false, cacheHint: {} };
            }
            if (entry && isVisible(entry)) {
                return successResult(wrapEntry(entry), {
                    isPreview: false,
                    fallbackLocale,
                    cacheHint: cacheHint ?? {},
                });
            }
            // Entry not found or not visible in this locale — try next
        }
        return { entry: null, isPreview: false, cacheHint: {} };
    };
    // A snapshot carries whatever references the caller asked for, so both the
    // key and the namespaces account for the selection: the key, or a render that
    // asked for references would be served one that did not; the namespaces, or
    // the snapshot would outlive a write to a child. A caller that asks for none
    // must keep the plain key and namespaces, which entries already in the cache
    // are stored under.
    const namespaces = references
        ? [...contentNamespaces(type), ...(await referenceTargetNamespaces(type, references))]
        : contentNamespaces(type);
    const referenceKey = references ? `|refs=${stableStringify(references)}` : "";
    const snapshot = await cachedQuery({
        namespace: namespaces,
        key: `entry:${id}|loc=${requestedLocale ?? ""}${referenceKey}`,
        load: async () => {
            const result = await resolveNormal();
            if (result.error) {
                return { ok: false, error: result.error, cacheHint: result.cacheHint };
            }
            return {
                ok: true,
                value: {
                    entry: result.entry ? entrySnapshot(result.entry) : null,
                    isPreview: result.isPreview,
                    fallbackLocale: result.fallbackLocale,
                    cacheHint: result.cacheHint,
                },
            };
        },
        cacheable: (snap) => snap.ok,
    });
    if (!snapshot.ok) {
        return { entry: null, error: snapshot.error, isPreview: false, cacheHint: snapshot.cacheHint };
    }
    const revived = snapshot.value.entry ? reviveEntry(snapshot.value.entry) : null;
    if (revived && !canExposeRevisionMetadata(revived, type))
        stripRevisionMetadata(revived);
    if (revived) {
        // On a warm object-cache hit the loader never runs, so prime the
        // SEO panel cache from the snapshot's data (a no-op after a miss,
        // where the loader already primed).
        // eslint-disable-next-line typescript/no-unsafe-type-assertion -- snapshot `data` is always a record
        const { id: rowId, seo } = revived.data;
        // eslint-disable-next-line typescript/no-unsafe-type-assertion -- `data.seo` is written by the loader as ContentSeo
        if (seo && typeof rowId === "string")
            primeSeoPanel(type, rowId, seo);
    }
    return {
        entry: revived,
        isPreview: snapshot.value.isPreview,
        fallbackLocale: snapshot.value.fallbackLocale,
        cacheHint: snapshot.value.cacheHint,
    };
}
/**
 * Get one page of a single reference field, without re-reading the entry it
 * hangs off.
 *
 * `getEmDashEntry({ references })` returns the first page of each field it is
 * asked for; this is how a "load more" walks past it, using the `nextCursor`
 * that page carried. Draft visibility follows the same request context — a
 * preview token for this entry, or edit mode — so a walk started in preview
 * keeps seeing the pending selection.
 *
 * @example
 * ```ts
 * import { getEmDashReferences } from "emdash";
 *
 * const more = await getEmDashReferences("posts", post.id, "related_posts", {
 *   cursor,
 *   limit: 20,
 * });
 * ```
 */
export async function getEmDashReferences(type, id, field, options) {
    const ctx = getRequestContext();
    const preview = ctx?.preview;
    const isEditMode = ctx?.editMode ?? false;
    const locale = options?.locale ?? ctx?.locale;
    try {
        const { getDb } = await import("./loader.js");
        const { ContentRepository } = await import("./database/repositories/content.js");
        const { resolveReferencePages } = await import("./references/resolve.js");
        const db = await getDb();
        const addressed = splitLocalePrefixedId(id, locale);
        const entry = await new ContentRepository(db).findByIdOrSlug(type, addressed.id, addressed.locale);
        if (!entry?.translationGroup)
            return { entries: [] };
        // Preview tokens are entry-scoped, so a token minted for another entry
        // gives no draft access here; edit mode is collection-wide.
        const previewMatches = !!preview && preview.collection === type && (preview.id === entry.id || preview.id === id);
        const serveDrafts = isEditMode || previewMatches;
        // Anchoring on an entry the caller may not see would let its links be
        // probed. An unpublished anchor is simply empty, as a missing one is.
        if (!serveDrafts && entry.status !== "published")
            return { entries: [] };
        const query = options?.limit === undefined && options?.cursor === undefined
            ? true
            : { limit: options.limit, cursor: options.cursor };
        const pages = await resolveReferencePages({
            collection: type,
            entryGroup: entry.translationGroup,
            locale: entry.locale,
            draftRevisionId: entry.draftRevisionId ?? undefined,
            serveDrafts,
            selection: { [field]: query },
        });
        const page = pages[field];
        if (!page)
            return { entries: [] };
        const tags = [];
        let lastModified;
        for (const child of page.entries) {
            tags.push(...child.cacheHint.tags);
            const modified = child.cacheHint.lastModified;
            if (modified && (!lastModified || modified > lastModified))
                lastModified = modified;
        }
        return {
            entries: page.entries.map((child) => wrapReferencedEntry(page.collection, child)),
            ...(page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor }),
            cacheHint: { tags, ...(lastModified ? { lastModified } : {}) },
        };
    }
    catch (error) {
        return { entries: [], error: error instanceof Error ? error : new Error(String(error)) };
    }
}
/**
 * Take a locale prefix off an entry id, and read it as the locale to look in.
 *
 * Wherever i18n prefixes a locale's URLs, an entry is addressed as `fr/about`
 * rather than `about` — that is the id the loader builds and the id a render
 * holds, including for a referenced entry. Rows are stored under the bare slug,
 * so the prefix has to become the locale instead. A first segment that is not a
 * configured locale is part of the identifier and stays put.
 */
function splitLocalePrefixedId(id, locale) {
    const slash = id.indexOf("/");
    if (slash === -1)
        return { id, locale };
    const prefix = id.slice(0, slash);
    if (!getI18nConfig()?.locales.includes(prefix))
        return { id, locale };
    return { id: id.slice(slash + 1), locale: prefix };
}
/**
 * Eagerly hydrate byline data onto entry.data for one or more entries.
 *
 * Attaches `bylines` (array of ContentBylineCredit) and `byline`
 * (primary BylineSummary or null) to each entry's data object.
 * Uses batch queries to avoid N+1.
 *
 * Fails silently if the byline tables don't exist yet (pre-migration).
 */
async function hydrateEntryBylines(type, entries) {
    if (entries.length === 0)
        return;
    // Fast path: bylines were folded into the content query. Parse the JSON
    // (no extra round trip) for the common case — explicit credits, no byline
    // custom fields, no author fallback. The query path below handles the rest:
    //  - author fallback (entry has authorId but no explicit credit), and
    //  - custom byline fields (can't be expressed in the folded subquery).
    if (entries.every((e) => FOLDED_BYLINES in entryData(e))) {
        const parsed = entries.map((entry) => {
            const data = entryData(entry);
            const folded = Reflect.get(data, FOLDED_BYLINES);
            const rows = Array.isArray(folded) ? folded : [];
            const credits = creditsFromFoldedBylines(rows);
            return { data, credits };
        });
        // An empty `_emdash_bylines` table makes an empty fold authoritative: no
        // credit can exist in any locale and the author fallback has no byline
        // to resolve to, so skip the query path and the custom-fields probe
        // entirely. A missing marker (older cached rows) means "unknown" and
        // keeps the conservative fallback below.
        const knownEmpty = entries.every((e) => Reflect.get(entryData(e), FOLDED_BYLINES_EXIST) === false);
        // Fall back to the full query path when the fold can't be trusted to be
        // complete: an entry with a byline reference (explicit primary, or an
        // author for the author-fallback) but no folded credits — e.g. a credit
        // in a different locale than the row, which the locale-correlated subquery
        // skips, or the author-fallback path which the fold doesn't express.
        let needsQueryPath = !knownEmpty &&
            parsed.some((p) => p.credits.length === 0 &&
                (dataStr(p.data, "authorId") !== "" || dataStr(p.data, "primaryBylineId") !== ""));
        let hasCustomFields = false;
        if (!needsQueryPath && !knownEmpty) {
            try {
                const { getDb } = await import("./loader.js");
                const db = await getDb();
                const { getBylineFieldDefs } = await import("./bylines/field-defs-cache.js");
                hasCustomFields = (await getBylineFieldDefs(db)).length > 0;
            }
            catch (error) {
                // A missing table is expected pre-migration and means there are no
                // custom fields — the fold's values are complete. Any other error
                // (lock-init failure, dialect error) means the probe can't be
                // trusted, so fall back to the query path rather than risk serving
                // folded bylines with empty customFields.
                if (!isMissingTableError(error))
                    needsQueryPath = true;
            }
        }
        if (!needsQueryPath && !hasCustomFields) {
            for (const p of parsed) {
                p.data.bylines = p.credits;
                p.data.byline = p.credits[0]?.byline ?? null;
            }
            return;
        }
        // Fall through to the full query path for fallback / custom-field cases.
    }
    try {
        const { getBylinesForEntries } = await import("./bylines/index.js");
        const refs = entries
            .map((e) => {
            const data = entryData(e);
            const id = dataStr(data, "id");
            if (!id)
                return null;
            return {
                id,
                authorId: dataStr(data, "authorId") || null,
                primaryBylineId: dataStr(data, "primaryBylineId") || null,
                locale: dataStr(data, "locale") || null,
            };
        })
            .filter((r) => r !== null);
        if (refs.length === 0)
            return;
        const bylinesMap = await getBylinesForEntries(type, refs);
        for (const entry of entries) {
            const data = entryData(entry);
            const dbId = dataStr(data, "id");
            if (!dbId)
                continue;
            const credits = bylinesMap.get(dbId) ?? [];
            data.bylines = credits;
            data.byline = credits[0]?.byline ?? null;
        }
    }
    catch (err) {
        // Only swallow "table not found" errors from pre-migration databases.
        // Matches SQLite/D1 ("no such table") and PostgreSQL ("relation/table
        // ... does not exist") via the shared helper.
        if (!isMissingTableError(err)) {
            const msg = err instanceof Error ? err.message : String(err);
            console.warn("[emdash] Failed to hydrate bylines:", msg);
        }
    }
}
/**
 * Eagerly hydrate taxonomy term data onto entry.data for one or more entries.
 *
 * Attaches `terms` (Record keyed by taxonomy name with an array of TaxonomyTerm
 * values) to each entry's data object. Uses a single batched JOIN query across
 * all taxonomies so the cost is O(1) regardless of the number of entries or
 * taxonomies on the site.
 *
 * This eliminates the common N+1 pattern where templates loop over list
 * results and call getEntryTerms() per entry. With hydration, the list page
 * stays at a single round-trip for term data.
 *
 * `locale` is the preferred locale the entries were resolved to. Each assigned
 * group resolves that variant first, then the configured default. When it is
 * omitted, the stored locale of each content row is preferred.
 *
 * Fails silently if the taxonomy tables don't exist yet (pre-migration).
 */
async function hydrateEntryTerms(type, entries, locale) {
    if (entries.length === 0)
        return;
    // Fast path: terms were folded into the content query. Group the JSON and
    // skip the separate content_taxonomies query.
    if (entries.every((e) => FOLDED_TERMS in entryData(e))) {
        const perEntry = [];
        for (const entry of entries) {
            const data = entryData(entry);
            const folded = Reflect.get(data, FOLDED_TERMS);
            const rows = Array.isArray(folded) ? folded : [];
            const grouped = {};
            for (const r of rows) {
                const name = String(r?.name);
                (grouped[name] ??= []).push({
                    id: r?.id,
                    name,
                    slug: r?.slug,
                    label: r?.label,
                    parentId: r?.parent_id ?? undefined,
                    children: [],
                    locale: r?.locale,
                    translationGroup: r?.translation_group,
                });
            }
            // Match getAllTermsForEntries' ORDER BY label (dropped from the
            // aggregate since SQLite and Postgres order it differently).
            for (const [name, arr] of Object.entries(grouped)) {
                grouped[name] = arr.toSorted((a, b) => String(a.label).localeCompare(String(b.label)));
            }
            data.terms = grouped;
            const entryId = dataStr(data, "id");
            if (entryId)
                perEntry.push({ entryId, byTaxonomy: grouped });
        }
        // Prime the per-entry request cache (wildcard + present taxonomies) so
        // subsequent getEntryTerms(...) calls in this render hit the cache instead
        // of issuing an N+1 query. No DB lookup — purely from the folded data.
        const { primeFoldedEntryTerms } = await import("./taxonomies/index.js");
        primeFoldedEntryTerms(type, perEntry, { locale });
        return;
    }
    try {
        const { getAllTermsForEntries } = await import("./taxonomies/index.js");
        const ids = entries.map((e) => dataStr(entryData(e), "id")).filter(Boolean);
        if (ids.length === 0)
            return;
        const termsMap = await getAllTermsForEntries(type, ids, { locale });
        for (const entry of entries) {
            const data = entryData(entry);
            const dbId = dataStr(data, "id");
            if (!dbId)
                continue;
            data.terms = termsMap.get(dbId) ?? {};
        }
    }
    catch (err) {
        // Only swallow "table not found" errors from pre-migration databases.
        // Matches SQLite/D1 ("no such table") and PostgreSQL ("relation/table
        // ... does not exist") via the shared helper.
        if (!isMissingTableError(err)) {
            const msg = err instanceof Error ? err.message : String(err);
            console.warn("[emdash] Failed to hydrate terms:", msg);
        }
    }
}
/**
 * Get all translations of a content item.
 *
 * Given a content entry, returns all locale variants that share the same
 * translation group. This is useful for building language switcher UI.
 *
 * @example
 * ```ts
 * import { getEmDashEntry, getTranslations } from "emdash";
 *
 * const { entry: post } = await getEmDashEntry("posts", "hello-world", { locale: "en" });
 * const { translations } = await getTranslations("posts", post.data.id);
 * // translations = [{ id: "...", locale: "en", slug: "hello-world", status: "published" }, ...]
 * ```
 */
export async function getTranslations(type, id) {
    try {
        const db = (await import("./loader.js")).getDb;
        const dbInstance = await db();
        const { ContentRepository } = await import("./database/repositories/content.js");
        const repo = new ContentRepository(dbInstance);
        // Find the item to get its translation group
        const item = await repo.findByIdOrSlug(type, id);
        if (!item) {
            return {
                translationGroup: "",
                translations: [],
                error: new Error(`Content item not found: ${id}`),
            };
        }
        const group = item.translationGroup || item.id;
        const translations = await repo.findTranslations(type, group);
        return {
            translationGroup: group,
            translations: translations.map((t) => ({
                id: t.id,
                locale: t.locale || "en",
                slug: t.slug,
                status: t.status,
            })),
        };
    }
    catch (error) {
        return {
            translationGroup: "",
            translations: [],
            error: error instanceof Error ? error : new Error(String(error)),
        };
    }
}
const URL_PATTERN_CACHE_KEY = Symbol.for("emdash:url-pattern-cache");
const queryGlobal = globalThis;
const urlPatternCache = 
// eslint-disable-next-line typescript/no-unsafe-type-assertion -- globalThis singleton pattern (see request-context.ts)
queryGlobal[URL_PATTERN_CACHE_KEY] ??
    (() => {
        const cache = { patterns: null };
        queryGlobal[URL_PATTERN_CACHE_KEY] = cache;
        return cache;
    })();
/**
 * Invalidate the cached URL patterns used by resolveEmDashPath.
 * Call when collection URL patterns change (schema updates).
 *
 * Also busts the distributed schema cache (collection metadata such as
 * `commentsEnabled`, `supports`, fields read by `getCollectionInfo`) and the
 * per-isolate registered-collection-slugs cache used by term counting, since
 * every schema-mutation path already routes through here.
 */
export function invalidateUrlPatternCache() {
    urlPatternCache.patterns = null;
    resetRegisteredCollectionsCache();
    invalidateSchemaObjectCache();
}
/**
 * Resolve a URL path to a content entry by matching against collection URL patterns.
 *
 * Loads all collections with a `urlPattern` set, converts each pattern to a regex,
 * and tests the given path. On match, extracts the slug and fetches the entry.
 *
 * @example
 * ```ts
 * import { resolveEmDashPath } from "emdash";
 *
 * // Given pages with urlPattern "/{slug}" and posts with "/blog/{slug}":
 * const result = await resolveEmDashPath("/blog/hello-world");
 * if (result) {
 *   console.log(result.collection); // "posts"
 *   console.log(result.params.slug); // "hello-world"
 *   console.log(result.entry.data); // post data
 * }
 * ```
 */
export async function resolveEmDashPath(path) {
    // Build and cache compiled patterns on first call
    let cachedUrlPatterns = urlPatternCache.patterns;
    if (!cachedUrlPatterns) {
        const { getDb } = await import("./loader.js");
        const { SchemaRegistry } = await import("./schema/registry.js");
        const db = await getDb();
        const registry = new SchemaRegistry(db);
        const collections = await registry.listCollections();
        cachedUrlPatterns = [];
        for (const collection of collections) {
            if (!collection.urlPattern)
                continue;
            try {
                const { regex, paramNames } = compileUrlPattern(collection.urlPattern);
                cachedUrlPatterns.push({ slug: collection.slug, regex, paramNames });
            }
            catch (error) {
                const reason = error instanceof Error ? error.message : String(error);
                console.warn(`[emdash] Skipping URL pattern "${collection.urlPattern}" for collection "${collection.slug}": ${reason}. Update the collection's URL pattern to route its entries.`);
            }
        }
        urlPatternCache.patterns = cachedUrlPatterns;
    }
    for (const pattern of cachedUrlPatterns) {
        const match = path.match(pattern.regex);
        if (!match)
            continue;
        // Extract params
        const params = {};
        for (let i = 0; i < pattern.paramNames.length; i++) {
            params[pattern.paramNames[i]] = match[i + 1];
        }
        // Look up entry by slug (most common pattern)
        const slug = params.slug;
        if (!slug)
            continue;
        const { entry } = await getEmDashEntry(pattern.slug, slug);
        if (entry) {
            return { entry, collection: pattern.slug, params };
        }
    }
    return null;
}
