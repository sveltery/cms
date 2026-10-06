export const MEDIA_USAGE_CONTENT_SOURCE_VARIANTS = ["columns", "draft_overlay"];
export function isMediaUsageContentSourceVariant(value) {
    return (typeof value === "string" &&
        MEDIA_USAGE_CONTENT_SOURCE_VARIANTS.includes(value));
}
export function buildContentMediaUsageSourceKey(input) {
    if (input.collectionId) {
        return `content:${input.collectionId}:${input.contentId}:${input.sourceVariant}`;
    }
    return `content:${input.collectionSlug}:${input.contentId}:${input.sourceVariant}`;
}
