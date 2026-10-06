import { z } from "astro/zod";
/**
 * Textarea field - multi-line text input
 */
export function textarea(options = {}) {
    let stringSchema = z.string();
    // Apply constraints
    if (options.minLength !== undefined) {
        stringSchema = stringSchema.min(options.minLength, `Must be at least ${options.minLength} characters`);
    }
    if (options.maxLength !== undefined) {
        stringSchema = stringSchema.max(options.maxLength, `Must be at most ${options.maxLength} characters`);
    }
    // Optional vs required
    const schema = options.required ? stringSchema : stringSchema.optional();
    const ui = {
        widget: "textarea",
        placeholder: options.placeholder,
        helpText: options.helpText,
        rows: options.rows || 6,
    };
    return {
        type: "textarea",
        columnType: "TEXT",
        schema,
        options,
        ui,
    };
}
