/**
 * Navigation menu runtime functions.
 *
 * These are called from templates to query menus and resolve URLs. All queries
 * are locale-aware: when a locale is configured (or passed explicitly) items
 * are filtered to that locale, and menu item references resolve against the
 * referenced content's translation_group so the URL points at the right
 * per-locale row.
 */
import { sql } from "kysely";
import { menuTag } from "../cache/chrome-tags.js";
import { validateIdentifier } from "../database/validate.js";
import { resolveLocalizedContentRoutePath, resolveLocale, resolveLocaleChain, } from "../i18n/resolve.js";
import { getDb } from "../loader.js";
import { cachedQuery, CacheNamespace } from "../object-cache/index.js";
import { requestCached } from "../request-cache.js";
import { chunks, SQL_BATCH_SIZE } from "../utils/chunks.js";
import { sanitizeHref } from "../utils/url.js";
/**
 * Get a menu by name with resolved URLs.
 *
 * @example
 * ```ts
 * const menu = await getMenu("primary");
 * const menuEs = await getMenu("primary", { locale: "es" });
 * ```
 */
export async function getMenu(name, options = {}) {
    const locale = resolveLocale(options.locale);
    const trailingSlash = options.trailingSlash ?? (await getHostTrailingSlash());
    return requestCached(`menu:${name}:${locale ?? "*"}:${trailingSlash}`, () => cachedQuery({
        namespace: CacheNamespace.MENUS,
        key: `${name}:${locale ?? "*"}:${trailingSlash}`,
        load: async () => {
            const db = await getDb();
            return getMenuWithDb(name, db, { locale, trailingSlash });
        },
    }));
}
async function getHostTrailingSlash() {
    try {
        const config = (await import("virtual:emdash/config"));
        return config.default?.trailingSlash ?? "ignore";
    }
    catch {
        return "ignore";
    }
}
/**
 * Get menu by name with resolved URLs (with explicit db). Internal helper for
 * admin routes that already have a database handle.
 */
export async function getMenuWithDb(name, db, options = {}) {
    const chain = resolveLocaleChain(options.locale);
    let query = db
        .selectFrom("_emdash_menus as m")
        .leftJoin("_emdash_menu_items as i", "i.menu_id", "m.id")
        .selectAll("i")
        .select([
        "m.id as m_id",
        "m.name as m_name",
        "m.label as m_label",
        "m.locale as m_locale",
        "m.translation_group as m_translation_group",
    ])
        .where("m.name", "=", name)
        .orderBy("i.sort_order", "asc");
    if (chain.length > 0)
        query = query.where("m.locale", "in", chain);
    const rows = await query.execute();
    const locales = new Set(rows.map((row) => row.m_locale));
    const locale = chain.length === 0 ? [...locales].toSorted()[0] : chain.find((l) => locales.has(l));
    const menuRow = rows.find((row) => row.m_locale === locale);
    if (!menuRow)
        return null;
    const menuId = menuRow.m_id;
    const itemRows = rows.filter((row) => row.m_id === menuId && row.id !== null);
    const items = await buildMenuTree(itemRows, db, menuRow.m_locale, options.trailingSlash);
    return {
        id: menuRow.m_id,
        name: menuRow.m_name,
        label: menuRow.m_label,
        items,
        locale: menuRow.m_locale,
        translationGroup: menuRow.m_translation_group,
    };
}
/**
 * Get all menus (without items, locale-filtered — for admin list / site nav
 * summaries). When no locale is configured, returns menus across all locales.
 */
export async function getMenus(options = {}) {
    const db = await getDb();
    return getMenusWithDb(db, options);
}
/**
 * Get all menus (with explicit db)
 *
 * @internal Use `getMenus()` in templates. This variant is for admin routes
 * that already have a database handle.
 */
export async function getMenusWithDb(db, options = {}) {
    const locale = resolveLocale(options.locale);
    let query = db
        .selectFrom("_emdash_menus")
        .select(["id", "name", "label", "locale"])
        .orderBy("name", "asc");
    if (locale !== undefined)
        query = query.where("locale", "=", locale);
    return query.execute();
}
/**
 * Get a menu by name with a Workers edge-cache hint.
 *
 * Use the returned `cacheHint` with `Astro.cache.set()` so pages that render
 * this menu can be purged automatically when the menu is edited.
 */
export async function getMenuWithCacheHint(name, options = {}) {
    const data = await getMenu(name, options);
    return { data, cacheHint: { tags: [menuTag(name)] } };
}
/**
 * Build a hierarchical menu tree from a flat list of items. Items are
 * resolved against the given `locale` so references land on the right
 * per-locale content rows.
 */
async function buildMenuTree(items, db, locale, trailingSlash) {
    const contentReferences = collectContentReferences(items);
    const taxonomyReferences = new Set(items.flatMap((item) => item.type === "taxonomy" && item.reference_id ? [item.reference_id] : []));
    const [urlPatterns, contentLookup, taxonomyLookup] = await Promise.all([
        contentReferences.size > 0
            ? getCollectionUrlPatterns(db, new Set(contentReferences.keys()))
            : new Map(),
        resolveContentReferences(db, contentReferences, locale),
        resolveTaxonomyReferences(db, taxonomyReferences, locale),
    ]);
    const resolvedItems = await Promise.all(items.map((item) => resolveMenuItem(item, urlPatterns, contentLookup, taxonomyLookup, locale, trailingSlash)));
    const validItems = resolvedItems.filter((item) => item !== null);
    const itemMap = new Map();
    const rootItems = [];
    for (const item of validItems) {
        itemMap.set(item.id, { ...item, children: [] });
    }
    for (const item of items) {
        const menuItem = itemMap.get(item.id);
        if (!menuItem)
            continue;
        if (item.parent_id) {
            const parent = itemMap.get(item.parent_id);
            if (parent)
                parent.children.push(menuItem);
            else
                rootItems.push(menuItem);
        }
        else {
            rootItems.push(menuItem);
        }
    }
    return rootItems;
}
function collectContentReferences(items) {
    const references = new Map();
    for (const item of items) {
        const reference = getContentReference(item);
        if (!reference)
            continue;
        let ids = references.get(reference.collection);
        if (!ids) {
            ids = new Set();
            references.set(reference.collection, ids);
        }
        ids.add(reference.id);
    }
    return references;
}
function getContentReference(item) {
    if (item.type === "page" || item.type === "post") {
        if (!item.reference_id)
            return null;
        return {
            collection: item.reference_collection || `${item.type}s`,
            id: item.reference_id,
        };
    }
    if (item.type === "collection") {
        if (!item.reference_collection || !item.reference_id)
            return null;
        return { collection: item.reference_collection, id: item.reference_id };
    }
    if (item.type !== "custom" &&
        item.type !== "taxonomy" &&
        item.reference_collection &&
        item.reference_id) {
        return { collection: item.reference_collection, id: item.reference_id };
    }
    return null;
}
/**
 * Look up the `url_pattern` for a set of collection slugs, request-cached so
 * a page rendering several menus (header, footer, ...) only pays for the
 * lookup once per distinct slug set. Callers must treat the returned map as
 * read-only — it is shared across cache hits within the request.
 */
function getCollectionUrlPatterns(db, collectionSlugs) {
    const key = `menu-collection-patterns:${[...collectionSlugs].toSorted().join(",")}`;
    return requestCached(key, async () => {
        const rows = await db
            .selectFrom("_emdash_collections")
            .select(["slug", "url_pattern"])
            .where("slug", "in", [...collectionSlugs])
            .execute();
        const urlPatterns = new Map();
        for (const row of rows)
            urlPatterns.set(row.slug, row.url_pattern);
        return urlPatterns;
    });
}
/**
 * Resolve a single menu item's URL. `reference_id` is a translation_group
 * (migration 036 remapped all existing references); we look it up against
 * the per-locale ec_* row or per-locale taxonomy row.
 */
async function resolveMenuItem(item, urlPatterns, contentLookup, taxonomyLookup, locale, trailingSlash) {
    let url;
    switch (item.type) {
        case "custom":
            url = item.custom_url || "#";
            break;
        case "page":
        case "post":
            url = await resolveContentUrl(item.reference_collection || `${item.type}s`, item.reference_id, urlPatterns, contentLookup, locale, trailingSlash);
            if (url === null)
                return null;
            break;
        case "taxonomy":
            url = resolveTaxonomyUrl(item.reference_id, taxonomyLookup);
            if (url === null)
                return null;
            break;
        case "collection":
            // Two shapes share this type: the admin content picker stores
            // entries from custom collections as "collection" with a
            // reference_id, while archive links carry only the collection
            // slug. Entry references resolve like page/post items.
            if (!item.reference_collection)
                return null;
            if (item.reference_id) {
                url = await resolveContentUrl(item.reference_collection, item.reference_id, urlPatterns, contentLookup, locale, trailingSlash);
                if (url === null)
                    return null;
            }
            else {
                url = `/${item.reference_collection}/`;
            }
            break;
        default:
            if (item.reference_collection && item.reference_id) {
                url = await resolveContentUrl(item.reference_collection, item.reference_id, urlPatterns, contentLookup, locale, trailingSlash);
                if (url === null)
                    return null;
            }
            else {
                url = "#";
            }
    }
    return {
        id: item.id,
        label: item.label,
        url: sanitizeHref(url),
        target: item.target || undefined,
        titleAttr: item.title_attr || undefined,
        cssClasses: item.css_classes || undefined,
        children: [],
    };
}
async function resolveContentReferences(db, references, locale) {
    const entries = await Promise.all(Array.from(references, async ([collection, referenceGroups]) => {
        const lookup = new Map();
        const localized = new Map();
        try {
            validateIdentifier(collection, "menu item collection");
            for (const batch of chunks([...referenceGroups], SQL_BATCH_SIZE)) {
                const result = await sql `
						SELECT id, slug, published_at, locale, translation_group
						FROM ${sql.ref(`ec_${collection}`)}
						WHERE translation_group IN (${sql.join(batch)})
					`.execute(db);
                for (const row of result.rows) {
                    const existing = localized.get(row.translation_group);
                    if (shouldPreferLocalizedRow(row, existing, locale)) {
                        localized.set(row.translation_group, row);
                    }
                }
            }
            for (const [referenceGroup, row] of localized) {
                lookup.set(referenceGroup, { id: row.id, slug: row.slug, publishedAt: row.published_at });
            }
            const unresolved = [...referenceGroups].filter((id) => !lookup.has(id));
            for (const batch of chunks(unresolved, SQL_BATCH_SIZE)) {
                const result = await sql `
						SELECT id, slug, published_at FROM ${sql.ref(`ec_${collection}`)}
						WHERE id IN (${sql.join(batch)})
					`.execute(db);
                for (const row of result.rows) {
                    lookup.set(row.id, { id: row.id, slug: row.slug, publishedAt: row.published_at });
                }
            }
        }
        catch (error) {
            console.error(`Failed to resolve content URLs for ${collection}:`, error);
        }
        return [collection, lookup];
    }));
    return new Map(entries);
}
function shouldPreferLocalizedRow(candidate, existing, locale) {
    if (!existing)
        return true;
    if (candidate.locale === locale)
        return existing.locale !== locale || candidate.id < existing.id;
    if (existing.locale === locale)
        return false;
    return (candidate.locale < existing.locale ||
        (candidate.locale === existing.locale && candidate.id < existing.id));
}
/**
 * Resolve the URL for a content reference. `referenceGroup` is the content
 * row's translation_group; we look up the row in the requested locale
 * (falling back to the source if no translation exists so the menu link is
 * still clickable).
 */
async function resolveContentUrl(collection, referenceGroup, urlPatterns, contentLookup, locale, trailingSlash) {
    if (!referenceGroup)
        return null;
    const row = contentLookup.get(collection)?.get(referenceGroup);
    if (!row)
        return null;
    return resolveLocalizedContentRoutePath({
        pattern: urlPatterns.get(collection) ?? null,
        collection,
        slug: row.slug,
        id: row.id,
        date: row.publishedAt,
        locale,
        trailingSlash,
    });
}
async function resolveTaxonomyReferences(db, referenceGroups, locale) {
    const lookup = new Map();
    const localized = new Map();
    try {
        for (const batch of chunks([...referenceGroups], SQL_BATCH_SIZE)) {
            const rows = await db
                .selectFrom("taxonomies")
                .select(["id", "name", "slug", "locale", "translation_group"])
                .where("translation_group", "in", batch)
                .$narrowType()
                .execute();
            for (const row of rows) {
                const existing = localized.get(row.translation_group);
                if (shouldPreferLocalizedRow(row, existing, locale)) {
                    localized.set(row.translation_group, row);
                }
            }
        }
        for (const [referenceGroup, row] of localized) {
            lookup.set(referenceGroup, { name: row.name, slug: row.slug });
        }
        const unresolved = [...referenceGroups].filter((id) => !lookup.has(id));
        for (const batch of chunks(unresolved, SQL_BATCH_SIZE)) {
            const rows = await db
                .selectFrom("taxonomies")
                .select(["id", "name", "slug"])
                .where("id", "in", batch)
                .execute();
            for (const row of rows)
                lookup.set(row.id, { name: row.name, slug: row.slug });
        }
    }
    catch (error) {
        console.error("Failed to resolve taxonomy URLs:", error);
    }
    return lookup;
}
/**
 * Resolve URL for a taxonomy term reference. `referenceGroup` is the term's
 * translation_group; we pick the row in the active locale (or fall back).
 */
function resolveTaxonomyUrl(referenceGroup, taxonomyLookup) {
    if (!referenceGroup)
        return null;
    const taxonomy = taxonomyLookup.get(referenceGroup);
    if (!taxonomy)
        return null;
    return `/${taxonomy.name}/${taxonomy.slug}`;
}
