import { z } from "astro/zod";
/**
 * Rich text field - Markdown content
 */
export function richText(options = {}) {
    const stringSchema = z.string();
    // Optional vs required
    const schema = options.required ? stringSchema : stringSchema.optional();
    const ui = {
        widget: "richText",
        helpText: options.helpText || "Markdown formatted text",
    };
    return {
        type: "richText",
        columnType: "TEXT",
        schema,
        options,
        ui,
    };
}
