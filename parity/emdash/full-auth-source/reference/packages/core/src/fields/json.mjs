import { z } from "astro/zod";
/**
 * JSON field - arbitrary JSON data
 */
export function json(options = {}) {
    // When T = unknown (default), z.unknown() is already z.ZodType<unknown>.
    // When a custom schema is provided, it carries the correct generic.
    // The generic constraint ensures type safety for callers.
    let schema = options.schema ?? z.unknown();
    // Optional vs required
    if (!options.required && !options.schema) {
        schema = z.unknown().optional();
    }
    const ui = {
        widget: "json",
        helpText: options.helpText || "JSON data",
    };
    return {
        type: "json",
        columnType: "JSON",
        schema,
        options,
        ui,
    };
}
