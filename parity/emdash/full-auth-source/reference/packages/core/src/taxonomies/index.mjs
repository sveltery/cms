/**
 * Runtime API for taxonomies.
 *
 * All helpers are locale-aware. When a locale is not passed explicitly we fall
 * back to the request context or the configured `defaultLocale` (see
 * `i18n/resolve.ts`).
 *
 * Because `content_taxonomies.taxonomy_id` stores the translation_group (not a
 * specific term id), and `entry_id` stores the content translation_group, one
 * assignment resolves to the requested locale on both sides.
 */
import { sql } from "kysely";
import { taxonomyTag } from "../cache/chrome-tags.js";
import { parseTaxonomyCollections, selectTaxonomyDefs, } from "../database/repositories/taxonomy-def.js";
import { validateIdentifier } from "../database/validate.js";
import { getI18nConfig } from "../i18n/config.js";
import { resolveLocale, resolveLocaleChain } from "../i18n/resolve.js";
import { getDb, resetTaxonomyNamesCache } from "../loader.js";
import { cachedQuery, CacheNamespace, contentCacheNamespaces, invalidateTaxonomyObjectCache, isObjectCacheActive, } from "../object-cache/index.js";
import { peekRequestCache, requestCached, setRequestCacheEntry } from "../request-cache.js";
import { getRequestContext } from "../request-context.js";
import { chunks, SQL_BATCH_SIZE } from "../utils/chunks.js";
import { isMissingTableError } from "../utils/db-errors.js";
import { fetchVisibleTermCounts } from "./term-counts.js";
async function selectEntryTermRows(db, collection, entryIds, taxonomyName, locale) {
    validateIdentifier(collection, "collection slug");
    const tableName = `ec_${collection}`;
    const preferredLocale = locale ? sql `${locale}` : sql `content.locale`;
    const defaultLocale = getI18nConfig()?.defaultLocale ?? "en";
    const result = await sql `
		SELECT content.id AS entry_id,
			coalesce(exact_term.id, default_term.id) AS id,
			coalesce(exact_term.name, default_term.name) AS name,
			coalesce(exact_term.slug, default_term.slug) AS slug,
			coalesce(exact_term.label, default_term.label) AS label,
			coalesce(exact_term.parent_id, default_term.parent_id) AS parent_id,
			coalesce(exact_term.locale, default_term.locale) AS locale,
			coalesce(exact_term.translation_group, default_term.translation_group) AS translation_group
		FROM ${sql.ref(tableName)} AS content
		INNER JOIN content_taxonomies AS pivot
			ON pivot.entry_id = content.translation_group
			AND pivot.collection = ${collection}
		LEFT JOIN taxonomies AS exact_term
			ON exact_term.translation_group = pivot.taxonomy_id
			AND exact_term.locale = ${preferredLocale}
		LEFT JOIN taxonomies AS default_term
			ON default_term.translation_group = pivot.taxonomy_id
			AND default_term.locale = ${defaultLocale}
		WHERE content.id IN (${sql.join(entryIds.map((id) => sql `${id}`))})
			AND coalesce(exact_term.id, default_term.id) IS NOT NULL
			${taxonomyName ? sql `AND coalesce(exact_term.name, default_term.name) = ${taxonomyName}` : sql ``}
		ORDER BY coalesce(exact_term.label, default_term.label) ASC
	`.execute(db);
    return result.rows;
}
/** Invalidate cached taxonomy term data and any content that hydrates terms. */
export function invalidateTermCache() {
    invalidateTaxonomyObjectCache();
}
const TAXONOMY_DEFS_CACHE_KEY = Symbol.for("emdash:taxonomy-defs");
const taxonomyDefsStore = globalThis;
const defsHolder = 
// eslint-disable-next-line typescript/no-unsafe-type-assertion -- globalThis singleton pattern (see settings/index.ts)
taxonomyDefsStore[TAXONOMY_DEFS_CACHE_KEY] ??
    (() => {
        const h = { version: 0, cache: new Map() };
        taxonomyDefsStore[TAXONOMY_DEFS_CACHE_KEY] = h;
        return h;
    })();
/**
 * Invalidate the isolate-wide taxonomy-definitions cache (and the related
 * loader taxonomy-names cache). Called from every taxonomy-def write path
 * (`handleTaxonomyCreate`/`Update`/`Delete`, seed application). Other isolates
 * refresh on their next recycle — staleness bounded by isolate lifetime.
 */
export function invalidateTaxonomyDefsCache() {
    defsHolder.version++;
    defsHolder.cache.clear();
    resetTaxonomyNamesCache();
    invalidateTaxonomyObjectCache();
}
/**
 * Test/internal helper: clear the per-isolate taxonomy-defs cache. Useful for
 * unit tests that insert defs directly and need to force a refetch without
 * going through a write path. Production code should rely on
 * `invalidateTaxonomyDefsCache()`.
 */
export function resetTaxonomyDefsCacheForTests() {
    defsHolder.version++;
    defsHolder.cache.clear();
}
/** Every locale's definition rows, straight from the database (no caching). */
async function fetchTaxonomyDefRows() {
    const db = await getDb();
    const rows = await selectTaxonomyDefs(db)
        .orderBy("d.name", "asc")
        .orderBy("d.locale", "asc")
        .execute();
    return rows.map(rowToTaxonomyDef);
}
/**
 * Resolve the definition rows through the isolate fallback cache, bypassing it
 * for isolated databases. The returned promise is cached (not the resolved
 * value) so concurrent cold-isolate readers share one in-flight query; a
 * rejection evicts the entry so the next caller retries.
 */
function loadTaxonomyDefRows() {
    if (getRequestContext()?.dbIsIsolated === true) {
        return fetchTaxonomyDefRows();
    }
    const existing = defsHolder.cache.get("all");
    if (existing && existing.version === defsHolder.version) {
        return existing.promise;
    }
    const version = defsHolder.version;
    const promise = fetchTaxonomyDefRows().catch((error) => {
        const current = defsHolder.cache.get("all");
        if (current && current.promise === promise) {
            defsHolder.cache.delete("all");
        }
        throw error;
    });
    defsHolder.cache.set("all", { version, promise });
    return promise;
}
/**
 * Every locale's definition rows. Two-tier cache: per-request via
 * `requestCached`, then the object cache when configured, else the isolate
 * holder, so warm renders issue zero queries whatever locale they ask for.
 */
function getTaxonomyDefRows() {
    return requestCached("taxonomy-def-rows", async () => {
        if (await isObjectCacheActive()) {
            return cachedQuery({
                namespace: CacheNamespace.TAXONOMIES,
                key: "defRows",
                load: fetchTaxonomyDefRows,
            });
        }
        return loadTaxonomyDefRows();
    });
}
/**
 * One definition per taxonomy, in the first locale of `chain` that has one.
 * A taxonomy with no definition anywhere on the chain still resolves, to its
 * default-locale row or else its lowest locale: its structure is the same in
 * every locale, and only the label falls back.
 */
function resolveDefs(rows, chain) {
    const defaultLocale = getI18nConfig()?.defaultLocale;
    const preference = defaultLocale === undefined ? chain : [...chain, defaultLocale];
    const byName = new Map();
    for (const row of rows) {
        const current = byName.get(row.name);
        if (!current || rank(row.locale) < rank(current.locale))
            byName.set(row.name, row);
    }
    return [...byName.values()];
    function rank(locale) {
        const index = preference.indexOf(locale);
        return index === -1 ? preference.length : index;
    }
}
/**
 * Get every taxonomy definition, one per taxonomy, labelled for the active
 * locale (see `resolveDefs` for the fallback).
 */
export async function getTaxonomyDefs(options = {}) {
    const chain = resolveLocaleChain(options.locale);
    return requestCached(`taxonomy-defs:${chain.join(",")}`, async () => resolveDefs(await getTaxonomyDefRows(), chain));
}
/**
 * Get a single taxonomy definition by name, labelled for the active locale.
 * Resolves whenever the taxonomy is defined in any locale (see `resolveDefs`).
 */
export async function getTaxonomyDef(name, options = {}) {
    const defs = await getTaxonomyDefs(options);
    return defs.find((def) => def.name === name) ?? null;
}
/**
 * Object-cache namespaces for values that embed visible term counts: the
 * taxonomy epoch (term/assignment writes) plus each counted collection's
 * content epoch, so publishing, unpublishing, or trashing an entry
 * invalidates the cached count promptly. Both content namespace generations
 * participate so rolling deployments preserve invalidation in either direction.
 */
function termCountNamespaces(collections) {
    return [
        ...[...new Set(collections)].flatMap((collection) => contentCacheNamespaces(collection)),
        CacheNamespace.TAXONOMIES,
    ];
}
/**
 * All terms of a taxonomy in a specific locale (flat for non-hierarchical,
 * tree for hierarchical).
 *
 * The term list and the visible-entry counts are loaded and cached separately:
 * the list depends only on the taxonomy epoch, while the counts additionally
 * depend on every counted collection's content epoch and cost an aggregate over
 * the whole assignment pivot. Callers that don't render counts pass
 * `includeCounts: false` and skip that aggregate entirely, while still sharing
 * the term list with callers that do.
 */
export async function getTaxonomyTerms(taxonomyName, options = {}) {
    const locale = resolveLocale(options.locale);
    const def = await getTaxonomyDef(taxonomyName, options);
    if (!def)
        return [];
    if (options.includeCounts === false)
        return getTermList(def, locale);
    // The two are independent, so run them concurrently to save a round trip.
    const [terms, counts] = await Promise.all([
        getTermList(def, locale),
        getVisibleTermCounts(def.name, def.collections, locale),
    ]);
    return withCounts(terms, counts);
}
/**
 * Get all terms of a taxonomy with a Workers edge-cache hint.
 *
 * Use the returned `cacheHint` with `Astro.cache.set()` so pages that render
 * a taxonomy facet can be purged automatically when taxonomy terms change.
 */
export async function getTaxonomyTermsWithCacheHint(taxonomyName, options = {}) {
    const data = await getTaxonomyTerms(taxonomyName, options);
    return { data, cacheHint: { tags: [taxonomyTag(taxonomyName)] } };
}
/** Terms without counts, under the cache keys the layout prefetch warms. */
function getTermList(def, locale) {
    const localeKey = locale ?? "*";
    return requestCached(`taxonomy-terms:${def.name}:${localeKey}`, () => cachedQuery({
        namespace: CacheNamespace.TAXONOMIES,
        key: `termList:${def.name}:${localeKey}`,
        load: () => loadTaxonomyTerms(def, locale),
    }));
}
/**
 * Copy a term list with counts attached. Counts are keyed by translation_group
 * (what the pivot stores) and are locale-independent. Rebuilds every node so
 * the shared, cached count-free list is never mutated.
 */
function withCounts(terms, counts) {
    return terms.map((term) => ({
        ...term,
        count: counts.get(term.translationGroup ?? term.id) ?? 0,
        children: withCounts(term.children, counts),
    }));
}
async function loadTaxonomyTerms(def, locale) {
    const db = await getDb();
    let termsQuery = db
        .selectFrom("taxonomies")
        .selectAll()
        .where("name", "=", def.name)
        .orderBy("sort_order", "asc")
        .orderBy("label", "asc");
    if (locale !== undefined)
        termsQuery = termsQuery.where("locale", "=", locale);
    const rows = await termsQuery.execute();
    const flatTerms = rows.map((row) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        label: row.label,
        parent_id: row.parent_id,
        data: row.data,
        locale: row.locale,
        translation_group: row.translation_group,
    }));
    if (def.hierarchical)
        return buildTree(flatTerms);
    return flatTerms.map((term) => ({
        id: term.id,
        name: term.name,
        slug: term.slug,
        label: term.label,
        description: term.data ? JSON.parse(term.data).description : undefined,
        children: [],
        locale: term.locale,
        translationGroup: term.translation_group,
    }));
}
/**
 * Per-translation-group visible-usage counts for one taxonomy, in a single
 * round-trip (see `fetchVisibleTermCounts`). The pivot identity is the
 * translation group, while entry rows are scoped to the resolved locale.
 * Request and object cache keys include that locale so translated views never
 * reuse each other's visible counts.
 */
function getVisibleTermCounts(taxonomyName, collections, locale) {
    // The collection scope is part of the key: a caller may pass a narrower
    // scope. Identical inputs (the widget + term-page hot path) still share one
    // entry.
    const scope = [...new Set(collections)].toSorted().join(",");
    const localeScope = locale ?? "*";
    return requestCached(`taxonomy-term-counts:${taxonomyName}:${scope}:${localeScope}`, async () => {
        // A Map is not JSON-representable — cache the entries, rebuild on read.
        const entries = await cachedQuery({
            namespace: termCountNamespaces(collections),
            key: `termCounts:${taxonomyName}:${scope}:${localeScope}`,
            load: async () => {
                const db = await getDb();
                return [...(await fetchVisibleTermCounts(db, taxonomyName, collections, locale))];
            },
        });
        return new Map(entries);
    });
}
/**
 * Get a single term by (taxonomy, slug). Honours the fallback chain — if the
 * slug exists in a fallback locale, we return that row (useful for deep-linking
 * to a term page when the translation is missing).
 *
 * The term row and its visible-entry count are loaded and cached separately: the
 * row depends only on the taxonomy epoch, while the count adds an aggregate over
 * the whole assignment pivot and every counted collection's content epoch. A
 * caller that renders no count passes `includeCounts: false` and skips it.
 */
export async function getTerm(taxonomyName, slug, options = {}) {
    const chain = resolveLocaleChain(options.locale);
    const term = await getTermRow(taxonomyName, slug, chain);
    if (!term)
        return null;
    if (options.includeCounts === false)
        return term;
    const collections = (await getTaxonomyDef(taxonomyName, options))?.collections ?? [];
    const counts = await getVisibleTermCounts(taxonomyName, collections, chain[0] ?? term.locale);
    return { ...term, count: counts.get(term.translationGroup ?? term.id) ?? 0 };
}
/** A single term with its children, without counts, under the taxonomy epoch. */
function getTermRow(taxonomyName, slug, chain) {
    return cachedQuery({
        namespace: CacheNamespace.TAXONOMIES,
        key: `term:${taxonomyName}:${slug}:${chain.join(",")}`,
        load: () => loadTerm(taxonomyName, slug, chain),
    });
}
async function loadTerm(taxonomyName, slug, chain) {
    const db = await getDb();
    let row;
    const selectTerm = () => db
        .selectFrom("taxonomies")
        .selectAll()
        .where("name", "=", taxonomyName)
        .where("slug", "=", slug);
    if (chain.length === 0) {
        row = await selectTerm().orderBy("locale", "asc").executeTakeFirst();
    }
    else {
        row = undefined;
        for (const locale of chain) {
            row = await selectTerm().where("locale", "=", locale).executeTakeFirst();
            if (row)
                break;
        }
    }
    if (!row)
        return null;
    let childrenQuery = db
        .selectFrom("taxonomies")
        .selectAll()
        // Children store the parent's translation_group in parent_id (not a row
        // id), so a translated parent still owns its children in its own locale.
        .where("parent_id", "=", row.translation_group ?? row.id)
        .orderBy("sort_order", "asc")
        .orderBy("label", "asc");
    const termLocale = row.locale;
    if (termLocale)
        childrenQuery = childrenQuery.where("locale", "=", termLocale);
    const childRows = await childrenQuery.execute();
    const children = childRows.map((child) => ({
        id: child.id,
        name: child.name,
        slug: child.slug,
        label: child.label,
        parentId: child.parent_id ?? undefined,
        children: [],
        locale: child.locale,
        translationGroup: child.translation_group,
    }));
    return {
        id: row.id,
        name: row.name,
        slug: row.slug,
        label: row.label,
        parentId: row.parent_id ?? undefined,
        description: row.data ? JSON.parse(row.data).description : undefined,
        children,
        locale: row.locale,
        translationGroup: row.translation_group,
    };
}
/**
 * Terms assigned to a content entry, resolved into the active locale and then
 * the configured default locale.
 */
export function getEntryTerms(collection, entryId, taxonomyName, options = {}) {
    const locale = resolveLocale(options.locale);
    // requestCached short-circuits to values primed by getAllTermsForEntries
    // during entry hydration (same key shape). On a warm content-cache hit
    // hydration doesn't run, so the inner cachedQuery serves this from KV
    // instead of falling through to D1 on every request.
    return requestCached(`terms:${collection}:${entryId}:${taxonomyName ?? "*"}:${locale ?? "*"}`, () => cachedQuery({
        namespace: [...contentCacheNamespaces(collection), CacheNamespace.TAXONOMIES],
        key: `entryTerms:${collection}:${entryId}:${taxonomyName ?? "*"}:${locale ?? "*"}`,
        load: async () => {
            const db = await getDb();
            const rows = await selectEntryTermRows(db, collection, [entryId], taxonomyName, locale);
            return rows.map((row) => ({
                id: row.id,
                name: row.name,
                slug: row.slug,
                label: row.label,
                parentId: row.parent_id ?? undefined,
                children: [],
                locale: row.locale,
                translationGroup: row.translation_group,
            }));
        },
    }));
}
/**
 * Terms for multiple entries of one taxonomy, single query.
 */
export async function getTermsForEntries(collection, entryIds, taxonomyName, options = {}) {
    const uniqueIds = [...new Set(entryIds)];
    if (uniqueIds.length === 0)
        return new Map();
    const locale = resolveLocale(options.locale);
    const localeKey = locale ?? "*";
    // The query result is a Map, which JSON can't represent — cache it as an
    // array of [entryId, terms] pairs and rebuild the Map on read.
    const load = async () => {
        const result = new Map();
        for (const id of uniqueIds)
            result.set(id, []);
        // Entry-term hydration (getAllTermsForEntries -> primeEntryTermsCache)
        // seeds the per-entry cache under the same key getEntryTerms uses:
        // `terms:${collection}:${entryId}:${taxonomyName}:${localeKey}`, storing a
        // TaxonomyTerm[] (including `[]` for entries with no terms). Satisfy those
        // from cache and run the batched query only for the ids that missed.
        const missedIds = [];
        const cacheReads = [];
        for (const id of uniqueIds) {
            const cached = peekRequestCache(`terms:${collection}:${id}:${taxonomyName}:${localeKey}`);
            if (cached) {
                // A peeked promise can reject (e.g. a sibling getEntryTerms hit a
                // missing table). Treat a rejection as a cache miss so the batched
                // query path -- and its isMissingTableError guard below -- still runs,
                // rather than propagating an uncaught error.
                cacheReads.push(cached.then((terms) => ({ id, terms }), () => ({ id, miss: true })));
            }
            else {
                missedIds.push(id);
            }
        }
        for (const read of await Promise.all(cacheReads)) {
            if ("miss" in read) {
                missedIds.push(read.id);
                continue;
            }
            // Return a private copy. The cached array and its term objects are shared
            // with getEntryTerms/getAllTermsForEntries (primeEntryTermsCache stores
            // the same references), so a caller that mutates the result -- sorting in
            // place, pushing into `children` -- must not poison the cache. The
            // pre-cache implementation always returned freshly built arrays.
            result.set(read.id, read.terms.map((t) => ({ ...t, children: [...t.children] })));
        }
        if (missedIds.length === 0)
            return [...result.entries()];
        const db = await getDb();
        for (const chunk of chunks(missedIds, SQL_BATCH_SIZE)) {
            let rows;
            try {
                rows = await selectEntryTermRows(db, collection, chunk, taxonomyName, locale);
            }
            catch (error) {
                if (isMissingTableError(error))
                    return [...result.entries()];
                throw error;
            }
            for (const row of rows) {
                const term = {
                    id: row.id,
                    name: row.name,
                    slug: row.slug,
                    label: row.label,
                    parentId: row.parent_id ?? undefined,
                    children: [],
                    locale: row.locale,
                    translationGroup: row.translation_group,
                };
                const terms = result.get(row.entry_id);
                if (terms)
                    terms.push(term);
            }
        }
        return [...result.entries()];
    };
    // Key on the sorted unique ids. Bound the key length: very large batches
    // (rare; they come from collection hydration, already served by the content
    // cache) bypass the object cache rather than blow past KV's key limit.
    const idKey = uniqueIds.toSorted().join(",");
    const pairs = idKey.length <= 256
        ? await cachedQuery({
            namespace: [...contentCacheNamespaces(collection), CacheNamespace.TAXONOMIES],
            key: `termsForEntries:${collection}:${taxonomyName}:${locale ?? "*"}:${idKey}`,
            load,
        })
        : await load();
    return new Map(pairs);
}
/**
 * Batch-fetch terms for multiple entries across ALL taxonomies in one query.
 * Primes the request-cache for subsequent per-entry calls to `getEntryTerms`.
 */
export async function getAllTermsForEntries(collection, entryIds, options = {}) {
    const result = new Map();
    const uniqueIds = [...new Set(entryIds)];
    for (const id of uniqueIds)
        result.set(id, {});
    if (uniqueIds.length === 0)
        return result;
    const db = await getDb();
    const locale = resolveLocale(options.locale);
    const applicableTaxonomyNames = await getCollectionTaxonomyNames(collection, { locale });
    for (const chunk of chunks(uniqueIds, SQL_BATCH_SIZE)) {
        let rows;
        try {
            rows = await selectEntryTermRows(db, collection, chunk, undefined, locale);
        }
        catch (error) {
            if (isMissingTableError(error)) {
                for (const id of uniqueIds) {
                    primeEntryTermsCache(collection, id, {}, applicableTaxonomyNames, locale);
                }
                return result;
            }
            throw error;
        }
        for (const row of rows) {
            const term = {
                id: row.id,
                name: row.name,
                slug: row.slug,
                label: row.label,
                parentId: row.parent_id ?? undefined,
                children: [],
                locale: row.locale,
                translationGroup: row.translation_group,
            };
            const byTaxonomy = result.get(row.entry_id);
            if (!byTaxonomy)
                continue;
            const existing = byTaxonomy[row.name];
            if (existing)
                existing.push(term);
            else
                byTaxonomy[row.name] = [term];
        }
    }
    for (const [entryId, byTaxonomy] of result) {
        primeEntryTermsCache(collection, entryId, byTaxonomy, applicableTaxonomyNames, locale);
    }
    return result;
}
/**
 * Return the list of taxonomy names applicable to a collection, request-
 * cached so a page render only pays for it once.
 *
 * Returns an empty list when taxonomies haven't been defined yet.
 */
async function getCollectionTaxonomyNames(collection, options) {
    try {
        const defs = await getTaxonomyDefs(options);
        return defs.filter((d) => d.collections.includes(collection)).map((d) => d.name);
    }
    catch (error) {
        if (isMissingTableError(error))
            return [];
        throw error;
    }
}
/**
 * Pre-populate the request-cache for every getEntryTerms call-shape that
 * could hit this entry:
 *
 *   getEntryTerms(collection, entryId)                 -> key `terms:C:E:*`
 *   getEntryTerms(collection, entryId, "tag")          -> key `terms:C:E:tag`
 *   getEntryTerms(collection, entryId, "category")     -> key `terms:C:E:category`
 *   ...one per taxonomy that applies to this collection
 *
 * Taxonomies with no rows on this entry are seeded with `[]` so legacy
 * callers short-circuit to the cached empty array instead of re-querying.
 */
function primeEntryTermsCache(collection, entryId, byTaxonomy, applicableTaxonomyNames, locale) {
    const localeKey = locale ?? "*";
    for (const name of applicableTaxonomyNames) {
        setRequestCacheEntry(`terms:${collection}:${entryId}:${name}:${localeKey}`, byTaxonomy[name] ?? []);
    }
    for (const [name, terms] of Object.entries(byTaxonomy)) {
        setRequestCacheEntry(`terms:${collection}:${entryId}:${name}:${localeKey}`, terms);
    }
    const allTerms = Object.values(byTaxonomy).flat();
    setRequestCacheEntry(`terms:${collection}:${entryId}:*:${localeKey}`, allTerms);
}
/**
 * Prime the per-entry request cache from terms that were folded into the
 * content query (query.ts `hydrateEntryTerms` fast path), so subsequent
 * `getEntryTerms` calls in the same render hit the cache instead of issuing an
 * N+1 query. Seeds the wildcard key and one key per taxonomy present on the
 * entry — purely from the folded data, with no DB lookup.
 *
 * Unlike `getAllTermsForEntries`, this deliberately does NOT seed `[]` for
 * taxonomies that apply to the collection but have no rows on the entry: doing
 * so would require a `getTaxonomyDefs` query, adding a round trip to every fold
 * render to serve the rarer `getEntryTerms(id, absentTaxonomy)` case from cache.
 * That call simply falls through to its own cached query. Keeping the key shape
 * here (rather than in query.ts) prevents the two from drifting.
 */
export function primeFoldedEntryTerms(collection, perEntry, options = {}) {
    if (perEntry.length === 0)
        return;
    const locale = resolveLocale(options.locale);
    for (const { entryId, byTaxonomy } of perEntry) {
        primeEntryTermsCache(collection, entryId, byTaxonomy, [], locale);
    }
}
/**
 * Get entries by term. Both the lookup (term slug in the active locale) and
 * the content query respect the active locale.
 */
export async function getEntriesByTerm(collection, taxonomyName, termSlug, options = {}) {
    const { getEmDashCollection } = await import("../query.js");
    const queryOptions = {
        where: { [taxonomyName]: termSlug },
    };
    if (options.locale !== undefined)
        queryOptions.locale = options.locale;
    const { entries } = await getEmDashCollection(collection, queryOptions);
    return entries;
}
function rowToTaxonomyDef(row) {
    return {
        id: row.id,
        name: row.name,
        label: row.label,
        labelSingular: row.label_singular ?? undefined,
        hierarchical: row.hierarchical === 1,
        collections: parseTaxonomyCollections(row.collections),
        locale: row.locale,
        translationGroup: row.translation_group,
    };
}
/**
 * Build tree structure from flat terms
 */
function buildTree(flatTerms) {
    // parent_id holds the parent's translation_group, so link children by it.
    // Key by (locale, group): a child's parent lives in the same locale, and an
    // unfiltered set mixes locales whose translated siblings share a group —
    // keying by group alone would collide and misattach children across locales.
    const byLocaleGroup = new Map();
    const nodes = [];
    const roots = [];
    for (const term of flatTerms) {
        const node = {
            id: term.id,
            name: term.name,
            slug: term.slug,
            label: term.label,
            parentId: term.parent_id ?? undefined,
            description: term.data ? JSON.parse(term.data).description : undefined,
            children: [],
            locale: term.locale,
            translationGroup: term.translation_group,
        };
        byLocaleGroup.set(`${term.locale}::${term.translation_group ?? term.id}`, node);
        nodes.push(node);
    }
    for (const node of nodes) {
        const parent = node.parentId
            ? byLocaleGroup.get(`${node.locale}::${node.parentId}`)
            : undefined;
        if (parent) {
            parent.children.push(node);
        }
        else {
            roots.push(node);
        }
    }
    return roots;
}
