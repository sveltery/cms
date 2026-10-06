import { z } from "astro/zod";
/**
 * Text field - single line text input
 */
export function text(options = {}) {
    let stringSchema = z.string();
    // Apply constraints
    if (options.minLength !== undefined) {
        stringSchema = stringSchema.min(options.minLength, `Must be at least ${options.minLength} characters`);
    }
    if (options.maxLength !== undefined) {
        stringSchema = stringSchema.max(options.maxLength, `Must be at most ${options.maxLength} characters`);
    }
    if (options.pattern) {
        stringSchema = stringSchema.regex(options.pattern, "Invalid format");
    }
    // Optional vs required
    const schema = options.required ? stringSchema : stringSchema.optional();
    const ui = {
        widget: "text",
        placeholder: options.placeholder,
        helpText: options.helpText,
    };
    return {
        type: "text",
        columnType: "TEXT",
        schema,
        options,
        ui,
    };
}
