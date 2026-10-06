export const MAX_ORDERED_LIST_START = 2_147_483_647;
export function normalizeListId(value) {
    if (typeof value !== "string")
        return undefined;
    const normalized = value.trim();
    return normalized.length > 0 && normalized.length <= 128 ? normalized : undefined;
}
export function normalizeListStart(value) {
    return typeof value === "number" &&
        Number.isInteger(value) &&
        value >= 1 &&
        value <= MAX_ORDERED_LIST_START
        ? value
        : undefined;
}
export function deriveLegacyListId(seed) {
    const readable = `legacy:${seed}`;
    if (readable.length <= 128)
        return readable;
    let hash = 2_166_136_261;
    for (let i = 0; i < seed.length; i++) {
        hash ^= seed.charCodeAt(i);
        hash = Math.imul(hash, 16_777_619);
    }
    return `legacy:${seed.slice(0, 96)}:${(hash >>> 0).toString(36)}:${seed.length.toString(36)}`;
}
export function readOrderedListMetadata(attrs, fallbackId) {
    return {
        listId: normalizeListId(attrs?.listId) ?? deriveLegacyListId(fallbackId),
        listStart: normalizeListStart(attrs?.listStart) ?? normalizeListStart(attrs?.start) ?? 1,
    };
}
function collectProseMirrorOrderedLists(doc) {
    const lists = [];
    const visit = (node, path, depth, context) => {
        if (node.type === "orderedList")
            lists.push({ node, path, depth, context });
        for (const [index, child] of (node.content ?? []).entries()) {
            const childPath = `${path}:${index}`;
            visit(child, childPath, depth + 1, child.type === "listItem" ? `listItem:${childPath}` : context);
        }
    };
    for (const [index, node] of doc.content.entries()) {
        visit(node, `root:${index}`, 0, "root");
    }
    return lists;
}
function cloneProseMirrorNode(node) {
    return {
        ...node,
        attrs: node.attrs ? { ...node.attrs } : undefined,
        content: node.content?.map(cloneProseMirrorNode),
        marks: node.marks?.map((mark) => ({
            ...mark,
            attrs: mark.attrs ? { ...mark.attrs } : undefined,
        })),
    };
}
function createRepairId(sourceId, scope, attempt) {
    const base = deriveLegacyListId(`repair:${sourceId}:${scope}`);
    const suffix = `:${attempt.toString(36)}`;
    return `${base.slice(0, 128 - suffix.length)}${suffix}`;
}
export function normalizeProseMirrorOrderedListJson(doc) {
    const normalized = {
        ...doc,
        content: doc.content.map(cloneProseMirrorNode),
    };
    const canonicalBySourceScope = new Map();
    const assignedCanonicalIds = new Set();
    const lists = collectProseMirrorOrderedLists(normalized).map((list) => {
        const sourceId = normalizeListId(list.node.attrs?.listId) ??
            deriveLegacyListId(`pm-json:${list.path}:${list.depth}:${list.context}`);
        const scope = JSON.stringify([list.depth, list.context]);
        const sourceScope = JSON.stringify([sourceId, scope]);
        let listId = canonicalBySourceScope.get(sourceScope);
        if (!listId) {
            if (!assignedCanonicalIds.has(sourceId)) {
                listId = sourceId;
            }
            else {
                let attempt = 0;
                do {
                    listId = createRepairId(sourceId, scope, attempt++);
                } while (assignedCanonicalIds.has(listId));
            }
            canonicalBySourceScope.set(sourceScope, listId);
            assignedCanonicalIds.add(listId);
        }
        return {
            ...list,
            listId,
            scopeKey: JSON.stringify([listId, list.depth, list.context]),
        };
    });
    const bases = new Map();
    for (const list of lists) {
        const listStart = normalizeListStart(list.node.attrs?.listStart);
        if (listStart !== undefined && !bases.has(list.scopeKey)) {
            bases.set(list.scopeKey, listStart);
        }
    }
    for (const list of lists) {
        if (!bases.has(list.scopeKey)) {
            bases.set(list.scopeKey, normalizeListStart(list.node.attrs?.start) ?? 1);
        }
    }
    const counts = new Map();
    for (const list of lists) {
        const listStart = bases.get(list.scopeKey);
        const count = counts.get(list.scopeKey) ?? 0;
        const start = normalizeListStart(listStart + count) ?? 1;
        const directItemCount = list.node.content?.filter((node) => node.type === "listItem").length ?? 0;
        counts.set(list.scopeKey, count + directItemCount);
        list.node.attrs = { ...list.node.attrs, listId: list.listId, listStart, start };
    }
    return normalized;
}
