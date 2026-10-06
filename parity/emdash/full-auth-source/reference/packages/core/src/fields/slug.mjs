import { z } from "astro/zod";
// Default slug pattern: lowercase alphanumeric + hyphens
const DEFAULT_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/**
 * Slug field - URL-safe identifier
 */
export function slug(options = {}) {
    const pattern = options.pattern || DEFAULT_SLUG_PATTERN;
    const stringSchema = z.string().regex(pattern, "Invalid slug format");
    // Optional vs required
    const schema = options.required ? stringSchema : stringSchema.optional();
    const ui = {
        widget: "slug",
        helpText: options.helpText || "URL-safe identifier (lowercase, hyphens only)",
        from: options.from,
    };
    return {
        type: "slug",
        columnType: "TEXT",
        schema,
        options,
        ui,
    };
}
