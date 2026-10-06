import { z } from "astro/zod";
/**
 * MultiSelect field - multiple choices from predefined options
 */
export function multiSelect(msOptions) {
    let arraySchema = z.array(z.enum(msOptions.options));
    // Apply constraints
    if (msOptions.min !== undefined) {
        arraySchema = arraySchema.min(msOptions.min, `Must select at least ${msOptions.min}`);
    }
    if (msOptions.max !== undefined) {
        arraySchema = arraySchema.max(msOptions.max, `Must select at most ${msOptions.max}`);
    }
    // Optional vs required
    const schema = msOptions.required ? arraySchema : arraySchema.optional();
    const ui = {
        widget: "multiSelect",
        helpText: msOptions.helpText,
        options: msOptions.options,
        min: msOptions.min,
        max: msOptions.max,
    };
    return {
        type: "multiSelect",
        columnType: "JSON",
        schema,
        options: msOptions,
        ui,
    };
}
