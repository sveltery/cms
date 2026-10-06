export function selectEditorDraftFields(selector, fields) {
    const selected = new Set(selector?.fields ?? []);
    if (selector?.translatable) {
        for (const [slug, field] of Object.entries(fields)) {
            if (field.translatable && !field.unsupportedType)
                selected.add(slug);
        }
    }
    return [...selected]
        .filter((slug) => fields[slug] && !fields[slug]?.unsupportedType)
        .slice(0, 32);
}
function appliesToCollection(collections, collection) {
    return collections === undefined || collections.includes(collection);
}
export function resolveSandboxedEditorPanels(plugins, collection) {
    const resolved = [];
    const seen = new Set();
    for (const pluginId of Object.keys(plugins ?? {}).toSorted()) {
        const plugin = plugins?.[pluginId];
        if (!plugin || plugin.enabled === false || plugin.adminMode !== "blocks")
            continue;
        for (const extension of plugin.editorPanels ?? []) {
            if (!extension.id || !extension.title || !extension.route)
                continue;
            const identity = `${pluginId}:${extension.id}`;
            if (seen.has(identity))
                continue;
            seen.add(identity);
            if (!appliesToCollection(extension.collections, collection))
                continue;
            resolved.push({ pluginId, extension });
        }
    }
    return resolved.toSorted((a, b) => (a.extension.order ?? 0) - (b.extension.order ?? 0) ||
        a.pluginId.localeCompare(b.pluginId) ||
        a.extension.id.localeCompare(b.extension.id));
}
export function resolveSandboxedEditorActions(plugins, collection) {
    const resolved = [];
    const seen = new Set();
    for (const pluginId of Object.keys(plugins ?? {}).toSorted()) {
        const plugin = plugins?.[pluginId];
        if (!plugin || plugin.enabled === false || plugin.adminMode !== "blocks")
            continue;
        for (const extension of plugin.editorActions ?? []) {
            if (!extension.id ||
                !extension.label ||
                !extension.route ||
                (extension.style === "danger" && !extension.confirm)) {
                continue;
            }
            const identity = `${pluginId}:${extension.id}`;
            if (seen.has(identity))
                continue;
            seen.add(identity);
            if (!appliesToCollection(extension.collections, collection))
                continue;
            resolved.push({ pluginId, extension });
        }
    }
    return resolved.toSorted((a, b) => a.pluginId.localeCompare(b.pluginId) || a.extension.id.localeCompare(b.extension.id));
}
export function editorExtensionUrl(collection, entryId, pluginId, kind, extensionId, locale) {
    const path = [collection, entryId, "plugin-extensions", pluginId, kind, extensionId]
        .map(encodeURIComponent)
        .join("/");
    const search = locale ? `?locale=${encodeURIComponent(locale)}` : "";
    return `/_emdash/api/content/${path}${search}`;
}
