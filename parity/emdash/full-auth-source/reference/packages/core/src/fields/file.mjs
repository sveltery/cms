import { z } from "astro/zod";
export function file(options = {}) {
    const fileObjSchema = z.object({
        id: z.string(),
        url: z.string().optional(),
        src: z.string().optional(),
        filename: z.string().optional(),
        mimeType: z.string().optional(),
        size: z.number().optional(),
        provider: z.string().optional(),
        meta: z.record(z.string(), z.unknown()).optional(),
    });
    const schema = options.required ? fileObjSchema : fileObjSchema.optional();
    const ui = {
        widget: "file",
        helpText: options.helpText,
        maxSize: options.maxSize,
    };
    const validation = options.allowedTypes && options.allowedTypes.length > 0
        ? { allowedMimeTypes: [...options.allowedTypes] }
        : undefined;
    return {
        type: "file",
        columnType: "TEXT",
        schema,
        options,
        ui,
        validation,
    };
}
