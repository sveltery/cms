import { z } from "astro/zod";
/**
 * Datetime field - date and time picker
 */
export function datetime(options = {}) {
    let dateSchema = z.date();
    // Apply constraints
    if (options.min !== undefined) {
        dateSchema = dateSchema.min(options.min, "Date is too early");
    }
    if (options.max !== undefined) {
        dateSchema = dateSchema.max(options.max, "Date is too late");
    }
    // Optional vs required
    const schema = options.required ? dateSchema : dateSchema.optional();
    const ui = {
        widget: "datetime",
        helpText: options.helpText,
        min: options.min?.toISOString(),
        max: options.max?.toISOString(),
    };
    return {
        type: "datetime",
        columnType: "TEXT",
        schema,
        options,
        ui,
    };
}
