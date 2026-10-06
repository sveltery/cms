/**
 * Resolve an entry's reference selections to loadable entries, for the public
 * query path.
 *
 * The cost is bounded and predictable: one link read per selected field, then
 * one entry read per *distinct* target collection — never one per link. A
 * caller that selects no fields issues nothing at all, which is what keeps
 * references off the logged-out hot path of every render that does not ask for
 * them.
 */
import { RelationRepository } from "../database/repositories/relation.js";
import { RevisionRepository } from "../database/repositories/revision.js";
import { getFallbackChain, isI18nEnabled } from "../i18n/config.js";
import { getDb, loadEntriesByGroups } from "../loader.js";
import { getReferenceFieldMap } from "./field-map.js";
import { pageStagedGroups, readStagedReferences, REFERENCE_PAGE_LIMIT, REFERENCE_PAGE_MAX_LIMIT, } from "./staged.js";
function pageOptions(query) {
    if (query === true)
        return { limit: REFERENCE_PAGE_LIMIT };
    const requested = query.limit ?? REFERENCE_PAGE_LIMIT;
    return {
        limit: Math.min(Math.max(requested, 1), REFERENCE_PAGE_MAX_LIMIT),
        cursor: query.cursor,
    };
}
function localeChainFor(locale) {
    if (locale === null)
        return [];
    return isI18nEnabled() ? getFallbackChain(locale) : [locale];
}
export async function resolveReferencePages(options) {
    const fieldMap = await getReferenceFieldMap(options.collection);
    const requested = Object.entries(options.selection).filter((entry) => entry[1] !== undefined && fieldMap.has(entry[0]));
    if (requested.length === 0)
        return {};
    const db = await getDb();
    const relations = new RelationRepository(db);
    const staged = options.serveDrafts && options.draftRevisionId
        ? readStagedReferences((await new RevisionRepository(db).findById(options.draftRevisionId))?.data)
        : undefined;
    // Phase one: each field's page of translation groups, in selection order.
    // Concurrent, like phase two — the fields are independent, and awaiting them
    // in turn would make N fields N sequential round trips.
    const pages = new Map(await Promise.all(requested.map(async ([slug, query]) => {
        const binding = fieldMap.get(slug);
        const page = pageOptions(query);
        const stagedGroups = staged?.[slug];
        if (stagedGroups)
            return [slug, pageStagedGroups(stagedGroups, page)];
        const links = binding.side === "child"
            ? await relations.getParentsPageById(binding.relationId, options.entryGroup, page)
            : await relations.getChildrenPageById(binding.relationId, options.entryGroup, page);
        return [
            slug,
            {
                groups: links.items.map((link) => binding.side === "child" ? link.parentGroup : link.childGroup),
                nextCursor: links.nextCursor,
            },
        ];
    })));
    // Phase two: one entry read per distinct target collection, however many
    // fields point at it.
    const groupsByCollection = new Map();
    for (const [slug, page] of pages) {
        const target = fieldMap.get(slug).targetCollection;
        const groups = groupsByCollection.get(target) ?? new Set();
        for (const group of page.groups)
            groups.add(group);
        groupsByCollection.set(target, groups);
    }
    const localeChain = localeChainFor(options.locale);
    const variantsByCollection = new Map();
    await Promise.all(Array.from(groupsByCollection, async ([collection, groups]) => {
        const loaded = await loadEntriesByGroups(collection, [...groups], {
            publishedOnly: !options.serveDrafts,
            localeChain,
        });
        const byGroup = new Map();
        for (const entry of loaded) {
            const group = entry.data.translationGroup;
            if (typeof group === "string")
                byGroup.set(group, entry);
        }
        variantsByCollection.set(collection, byGroup);
    }));
    // Phase three: rebuild each field in link order. A group with no surviving
    // variant — deleted, or unpublished for a render that may not see drafts —
    // drops out, exactly as a dangling link does.
    const resolved = {};
    for (const [slug, page] of pages) {
        const collection = fieldMap.get(slug).targetCollection;
        const byGroup = variantsByCollection.get(collection);
        const entries = [];
        for (const group of page.groups) {
            const variant = byGroup?.get(group);
            if (variant)
                entries.push(variant);
        }
        resolved[slug] = page.nextCursor
            ? { collection, entries, nextCursor: page.nextCursor }
            : { collection, entries };
    }
    return resolved;
}
