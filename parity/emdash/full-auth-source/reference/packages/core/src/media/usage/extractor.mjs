import { normalizeMime } from "../mime.js";
import { INTERNAL_MEDIA_PREFIX } from "../normalize.js";
const URL_LIKE_RE = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;
export function extractMediaUsageOccurrences({ fields, data, }) {
    const occurrences = [];
    const seen = new Set();
    for (const field of fields) {
        const value = data[field.slug];
        if (field.type === "image") {
            addImageOccurrences(occurrences, seen, field.slug, field.slug, value);
            continue;
        }
        if (field.type === "file") {
            addOccurrence(occurrences, seen, {
                fieldSlug: field.slug,
                fieldPath: field.slug,
                referenceType: "file_field",
                value,
                fallbackKind: null,
            });
            continue;
        }
        if (field.type === "repeater") {
            extractRepeaterOccurrences(occurrences, seen, field.slug, value, field.validation?.subFields);
            continue;
        }
        if (field.type === "portableText") {
            extractPortableTextOccurrences(occurrences, seen, field.slug, value);
            continue;
        }
        if (field.type === "blocks") {
            extractBlockOccurrences(occurrences, seen, field, value);
        }
    }
    return occurrences;
}
function extractRepeaterOccurrences(occurrences, seen, fieldSlug, value, subFields, pathPrefix = fieldSlug) {
    if (!Array.isArray(value) || !Array.isArray(subFields))
        return;
    for (const [itemIndex, item] of value.entries()) {
        if (!isRecord(item))
            continue;
        for (const subField of subFields) {
            if (subField.type !== "image")
                continue;
            addImageOccurrences(occurrences, seen, fieldSlug, `${pathPrefix}[${itemIndex}].${subField.slug}`, item[subField.slug]);
        }
    }
}
function addImageOccurrences(occurrences, seen, fieldSlug, fieldPath, value) {
    addOccurrence(occurrences, seen, {
        fieldSlug,
        fieldPath,
        referenceType: "image_field",
        value,
        fallbackKind: "image",
    });
    if (isRecord(value) && value.darkVariant != null) {
        addOccurrence(occurrences, seen, {
            fieldSlug,
            fieldPath: `${fieldPath}.darkVariant`,
            referenceType: "image_field",
            value: value.darkVariant,
            fallbackKind: "image",
        });
    }
}
function extractPortableTextOccurrences(occurrences, seen, fieldSlug, value, pathPrefix = fieldSlug) {
    if (!Array.isArray(value))
        return;
    for (const [blockIndex, block] of value.entries()) {
        if (!isRecord(block))
            continue;
        if (block._type === "image") {
            addPortableTextAssetOccurrence(occurrences, seen, fieldSlug, `${pathPrefix}[${blockIndex}]`, block.asset);
            continue;
        }
        // A gallery block holds its images in `images[]`, each with its own asset.
        if (block._type === "gallery" && Array.isArray(block.images)) {
            for (const [imageIndex, image] of block.images.entries()) {
                if (!isRecord(image))
                    continue;
                addPortableTextAssetOccurrence(occurrences, seen, fieldSlug, `${pathPrefix}[${blockIndex}].images[${imageIndex}]`, image.asset);
            }
        }
    }
}
export class MediaUsageBlockResolutionError extends Error {
    constructor(message) {
        super(message);
        this.name = "MediaUsageBlockResolutionError";
    }
}
function extractBlockOccurrences(occurrences, seen, field, value) {
    if (!Array.isArray(value))
        return;
    const types = new Map((field.blockTypes ?? []).map((type) => [type.slug, type]));
    for (const [index, block] of value.entries()) {
        if (!isRecord(block))
            continue;
        if (typeof block._type !== "string" ||
            typeof block._version !== "number" ||
            typeof block._key !== "string" ||
            block._key.length === 0) {
            throw new MediaUsageBlockResolutionError(`Block at ${field.slug}[${index}] has invalid identity metadata`);
        }
        const type = types.get(block._type);
        const version = type?.versions.find((candidate) => candidate.version === block._version);
        if (!type || !version || version.unsupportedTypes?.length) {
            throw new MediaUsageBlockResolutionError(`Block at ${field.slug}[${index}] has no retained definition`);
        }
        const pathPrefix = `${field.slug}.${block._key}`;
        for (const nestedField of version.fields) {
            const nestedValue = block[nestedField.slug];
            const nestedPath = `${pathPrefix}.${nestedField.slug}`;
            if (nestedField.type === "image") {
                addImageOccurrences(occurrences, seen, field.slug, nestedPath, nestedValue);
            }
            else if (nestedField.type === "file") {
                addOccurrence(occurrences, seen, {
                    fieldSlug: field.slug,
                    fieldPath: nestedPath,
                    referenceType: "file_field",
                    value: nestedValue,
                    fallbackKind: null,
                });
            }
            else if (nestedField.type === "portableText") {
                extractPortableTextOccurrences(occurrences, seen, field.slug, nestedValue, nestedPath);
            }
            else if (nestedField.type === "repeater") {
                extractRepeaterOccurrences(occurrences, seen, field.slug, nestedValue, nestedField.validation?.subFields, nestedPath);
            }
        }
    }
}
function addPortableTextAssetOccurrence(occurrences, seen, fieldSlug, pathPrefix, asset) {
    if (!isRecord(asset))
        return;
    const provider = normalizeProvider(asset.provider);
    const ref = readPortableTextAssetRef(asset, provider);
    if (!ref)
        return;
    addRefOccurrence(occurrences, seen, {
        fieldSlug,
        fieldPath: `${pathPrefix}.asset.${ref.key}`,
        referenceType: "portable_text_image",
        ref: buildMediaRef({
            id: ref.id,
            provider,
            mimeType: normalizeMimeValue(asset.mimeType),
            fallbackKind: "image",
        }),
    });
}
function addOccurrence(occurrences, seen, input) {
    const ref = readMediaRef(input.value, input.fallbackKind);
    if (!ref)
        return;
    addRefOccurrence(occurrences, seen, {
        fieldSlug: input.fieldSlug,
        fieldPath: input.fieldPath,
        referenceType: input.referenceType,
        ref,
    });
}
function addRefOccurrence(occurrences, seen, input) {
    if (!input.ref)
        return;
    const occurrence = {
        fieldSlug: input.fieldSlug,
        fieldPath: input.fieldPath,
        occurrenceIndex: 0,
        referenceType: input.referenceType,
        mediaId: input.ref.mediaId,
        provider: input.ref.provider,
        providerAssetId: input.ref.providerAssetId,
        mediaKind: input.ref.mediaKind,
        mimeType: input.ref.mimeType,
    };
    const key = [
        occurrence.fieldSlug,
        occurrence.fieldPath,
        occurrence.occurrenceIndex,
        occurrence.referenceType,
        occurrence.provider,
        occurrence.providerAssetId,
        occurrence.mediaId ?? "",
    ].join("\0");
    if (seen.has(key))
        return;
    seen.add(key);
    occurrences.push(occurrence);
}
function readMediaRef(value, fallbackKind) {
    if (typeof value === "string") {
        const id = normalizeLocalMediaId(value);
        return id ? buildMediaRef({ id, provider: "local", mimeType: null, fallbackKind }) : null;
    }
    if (!isRecord(value))
        return null;
    const provider = normalizeProvider(value.provider);
    const id = provider === "local" ? normalizeLocalMediaId(value.id) : normalizeStableId(value.id);
    if (!id)
        return null;
    return buildMediaRef({
        id,
        provider,
        mimeType: normalizeMimeValue(value.mimeType),
        fallbackKind,
    });
}
function buildMediaRef(input) {
    const provider = normalizeProvider(input.provider);
    if (provider === "external")
        return null;
    return {
        mediaId: provider === "local" ? input.id : null,
        provider,
        providerAssetId: input.id,
        mediaKind: mediaKindFromMime(input.mimeType) ?? input.fallbackKind,
        mimeType: input.mimeType,
    };
}
function readPortableTextAssetRef(asset, provider) {
    const normalizeId = provider === "local" ? normalizeLocalMediaId : normalizeStableId;
    const ref = normalizeId(asset._ref);
    if (ref)
        return { key: "_ref", id: ref };
    const id = normalizeId(asset.id);
    if (id)
        return { key: "id", id };
    return null;
}
function normalizeProvider(value) {
    const provider = readString(value)?.trim();
    return provider || "local";
}
function normalizeLocalMediaId(value) {
    const id = normalizeStableId(value);
    if (!id)
        return null;
    return id.includes("/") ? null : id;
}
function normalizeStableId(value) {
    if (typeof value !== "string")
        return null;
    const trimmed = value.trim();
    if (!trimmed)
        return null;
    if (URL_LIKE_RE.test(trimmed))
        return null;
    if (trimmed.startsWith(INTERNAL_MEDIA_PREFIX))
        return null;
    return trimmed;
}
function normalizeMimeValue(value) {
    if (typeof value !== "string")
        return null;
    const normalized = normalizeMime(value);
    return normalized.includes("/") ? normalized : null;
}
function mediaKindFromMime(mimeType) {
    if (!mimeType)
        return null;
    if (mimeType.startsWith("image/"))
        return "image";
    if (mimeType.startsWith("video/"))
        return "video";
    if (mimeType.startsWith("audio/"))
        return "audio";
    if (mimeType.startsWith("font/") || mimeType.startsWith("application/font-"))
        return "font";
    if (mimeType.startsWith("text/"))
        return "text";
    if (isDocumentMime(mimeType))
        return "document";
    if (isArchiveMime(mimeType))
        return "archive";
    return "other";
}
function isDocumentMime(mimeType) {
    return (mimeType === "application/pdf" ||
        mimeType === "application/msword" ||
        mimeType === "application/rtf" ||
        mimeType === "application/vnd.ms-excel" ||
        mimeType === "application/vnd.ms-powerpoint" ||
        mimeType.startsWith("application/vnd.openxmlformats-officedocument."));
}
function isArchiveMime(mimeType) {
    return (mimeType === "application/zip" ||
        mimeType === "application/gzip" ||
        mimeType === "application/x-tar" ||
        mimeType === "application/x-7z-compressed" ||
        mimeType === "application/x-rar-compressed" ||
        mimeType === "application/vnd.rar");
}
function readString(value) {
    return typeof value === "string" ? value : null;
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
