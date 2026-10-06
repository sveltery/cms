/**
 * Types for Gutenberg to Portable Text conversion
 */
// ── Attribute accessor helpers ──────────────────────────────────────
// Gutenberg attrs are Record<string, unknown>. These narrow safely
// without `as` casts.
/** Extract a string attribute, returning undefined if missing or wrong type */
export function attrString(attrs, key) {
    const v = attrs[key];
    return typeof v === "string" ? v : undefined;
}
/** Extract a number attribute, returning undefined if missing or wrong type */
export function attrNumber(attrs, key) {
    const v = attrs[key];
    return typeof v === "number" ? v : undefined;
}
/** Extract a boolean attribute, returning undefined if missing or wrong type */
export function attrBoolean(attrs, key) {
    const v = attrs[key];
    return typeof v === "boolean" ? v : undefined;
}
function isRecord(v) {
    return typeof v === "object" && v !== null && !Array.isArray(v);
}
/** Extract an object attribute, returning undefined if missing or wrong type */
export function attrObject(attrs, key) {
    const v = attrs[key];
    return isRecord(v) ? v : undefined;
}
