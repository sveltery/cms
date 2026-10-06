/**
 * Stable cache tags for EmDash chrome (settings, menus, taxonomies, widget areas).
 *
 * These tags are used by both the public read helpers (cacheHint) and the
 * admin write routes (cache.invalidate), closing the Workers edge cache loop.
 */
const PREFIX = "emdash";
export function siteSettingsTag() {
    return `${PREFIX}:settings`;
}
export function menuTag(name) {
    return `${PREFIX}:menu:${name}`;
}
export function taxonomyTag(name) {
    return `${PREFIX}:taxonomy:${name}`;
}
export function widgetAreaTag(name) {
    return `${PREFIX}:widget-area:${name}`;
}
