import { z } from "astro/zod";
/**
 * Boolean field - checkbox/toggle
 */
export function boolean(options = {}) {
    const boolSchema = z.boolean();
    // Apply default
    const schema = options.default !== undefined ? boolSchema.default(options.default) : boolSchema;
    const ui = {
        widget: "boolean",
        label: options.label,
        helpText: options.helpText,
    };
    return {
        type: "boolean",
        columnType: "INTEGER",
        schema,
        options,
        ui,
    };
}
