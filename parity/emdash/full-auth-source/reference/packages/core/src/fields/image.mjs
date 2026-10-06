import { z } from "astro/zod";
const mediaSchema = z.object({
    id: z.string(),
    src: z.string().optional(),
    alt: z.string().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
    filename: z.string().optional(),
    mimeType: z.string().optional(),
    blurhash: z.string().optional(),
    dominantColor: z.string().optional(),
    focalX: z.number().optional(),
    focalY: z.number().optional(),
    provider: z.string().optional(),
    previewUrl: z.string().optional(),
    meta: z.record(z.string(), z.unknown()).optional(),
});
const imageSchema = mediaSchema.extend({
    darkVariant: mediaSchema.optional(),
});
export function image(options = {}) {
    const validation = options.allowedTypes && options.allowedTypes.length > 0
        ? { allowedMimeTypes: [...options.allowedTypes] }
        : undefined;
    return {
        type: "image",
        columnType: "TEXT",
        schema: options.required === false ? imageSchema.optional() : imageSchema,
        options,
        ui: {
            widget: "image",
        },
        validation,
    };
}
