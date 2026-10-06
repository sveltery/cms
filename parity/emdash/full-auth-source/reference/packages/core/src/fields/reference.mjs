import { z } from "astro/zod";
/**
 * Reference field
 * References another content item by ID
 */
export function reference(collection, options) {
    const schema = z.string();
    return {
        type: "reference",
        columnType: "TEXT",
        schema: options?.required === false ? schema.optional() : schema,
        options: {
            ...options,
            collection,
        },
        ui: {
            widget: "reference",
        },
    };
}
