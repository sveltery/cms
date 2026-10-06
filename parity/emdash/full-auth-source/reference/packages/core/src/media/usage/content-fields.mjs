import { validateIdentifier } from "../../database/validate.js";
import { BlockTypeRegistry } from "../../schema/block-type-registry.js";
import { buildCanonicalSha256Fingerprint } from "./projection-fingerprint.js";
import { CONTENT_SOURCE_SCHEMA_VERSION } from "./types.js";
export async function buildContentMediaUsageFieldFingerprint(discovery) {
    const extractionFields = discovery.extractionFields
        .map((field) => ({
        slug: field.slug,
        type: field.type,
        ...(field.type === "blocks"
            ? {
                blockTypes: (field.blockTypes ?? []).map((type) => ({
                    slug: type.slug,
                    currentVersion: type.currentVersion,
                    versions: type.versions.map((version) => ({
                        version: version.version,
                        fingerprint: version.fingerprint,
                    })),
                })),
            }
            : {}),
        ...(field.type === "repeater"
            ? {
                subFields: (field.validation?.subFields ?? [])
                    .map((subField) => ({ slug: subField.slug, type: subField.type }))
                    .toSorted(compareFieldIdentity),
            }
            : {}),
    }))
        .toSorted(compareFieldIdentity);
    const result = await buildCanonicalSha256Fingerprint("media-usage-fields:v1:sha256:", {
        fingerprintVersion: 1,
        contentSourceSchemaVersion: CONTENT_SOURCE_SCHEMA_VERSION,
        extractionFields,
        displayFieldSlugs: discovery.displayFieldSlugs.toSorted(compareStrings),
    });
    return result.fingerprint;
}
export class MediaUsageFieldDiscoveryError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "MediaUsageFieldDiscoveryError";
    }
}
const DISPLAY_FIELD_SLUGS = ["title", "name"];
const SUPPORTED_TOP_LEVEL_TYPES = ["file", "image", "portableText"];
export async function loadContentMediaUsageFields(db, collectionSlug, collectionId) {
    validateIdentifier(collectionSlug, "collection slug");
    let query = db
        .selectFrom("_emdash_fields")
        .innerJoin("_emdash_collections", "_emdash_collections.id", "_emdash_fields.collection_id")
        .select(["_emdash_fields.slug", "_emdash_fields.type", "_emdash_fields.validation"])
        .where("_emdash_collections.slug", "=", collectionSlug);
    if (collectionId !== undefined)
        query = query.where("_emdash_collections.id", "=", collectionId);
    const rows = await query.execute();
    const extractionFields = [];
    const rowBySlug = new Map();
    const allBlockTypes = rows.some((row) => row.type === "blocks")
        ? await new BlockTypeRegistry(db).listBlockTypes()
        : [];
    for (const row of rows) {
        rowBySlug.set(row.slug, row);
        if (isSupportedTopLevelType(row.type)) {
            validateIdentifier(row.slug, "media usage field slug");
            extractionFields.push({ slug: row.slug, type: row.type });
            continue;
        }
        if (row.type === "repeater") {
            validateIdentifier(row.slug, "media usage field slug");
            const subFields = normalizeRepeaterImageSubFields(row.validation);
            if (subFields.length > 0) {
                extractionFields.push({
                    slug: row.slug,
                    type: "repeater",
                    validation: { subFields },
                });
            }
        }
        if (row.type === "blocks") {
            validateIdentifier(row.slug, "media usage field slug");
            const configured = parseBlockTypeSlugs(row.validation);
            const blockTypes = resolveMediaBlockTypes(allBlockTypes, configured);
            extractionFields.push({ slug: row.slug, type: "blocks", blockTypes });
        }
    }
    extractionFields.sort((a, b) => a.slug.localeCompare(b.slug));
    return {
        extractionFields,
        displayFieldSlugs: DISPLAY_FIELD_SLUGS.filter((slug) => {
            if (!rowBySlug.has(slug))
                return false;
            validateIdentifier(slug, "media usage display field slug");
            return true;
        }),
    };
}
function parseBlockTypeSlugs(rawValidation) {
    const validation = parseValidation(rawValidation, "block");
    if (!isRecord(validation)) {
        throw new MediaUsageFieldDiscoveryError("Blocks field validation must be an object before media usage can be discovered", "INVALID_BLOCK_VALIDATION");
    }
    const allowed = Array.isArray(validation.allowedTypes) ? validation.allowedTypes : [];
    const retired = Array.isArray(validation.retiredTypes) ? validation.retiredTypes : [];
    const values = [...allowed, ...retired];
    if (values.some((value) => typeof value !== "string")) {
        throw new MediaUsageFieldDiscoveryError("Blocks field type lists must contain strings before media usage can be discovered", "INVALID_BLOCK_VALIDATION");
    }
    return [...new Set(values)];
}
function resolveMediaBlockTypes(types, slugs) {
    const bySlug = new Map(types.map((type) => [type.slug, type]));
    return slugs.map((slug) => {
        const type = bySlug.get(slug);
        if (!type || type.versions.some((version) => version.unsupportedTypes?.length)) {
            throw new MediaUsageFieldDiscoveryError(`Block type "${slug}" cannot be resolved for media usage`, "UNSUPPORTED_BLOCK_DEFINITION");
        }
        return type;
    });
}
function normalizeRepeaterImageSubFields(rawValidation) {
    const validation = parseValidation(rawValidation, "repeater");
    if (!isRecord(validation) || !Array.isArray(validation.subFields))
        return [];
    const subFields = [];
    for (const subField of validation.subFields) {
        if (!isRecord(subField) || subField.type !== "image")
            continue;
        if (typeof subField.slug !== "string")
            continue;
        validateIdentifier(subField.slug, "media usage repeater sub-field slug");
        subFields.push({ slug: subField.slug, type: "image" });
    }
    return subFields.toSorted((a, b) => a.slug.localeCompare(b.slug));
}
function parseValidation(rawValidation, kind) {
    if (!rawValidation)
        return null;
    try {
        return JSON.parse(rawValidation);
    }
    catch {
        throw new MediaUsageFieldDiscoveryError(`${kind === "block" ? "Blocks" : "Repeater"} field validation must be valid JSON before media usage can be discovered`, kind === "block" ? "INVALID_BLOCK_VALIDATION" : "INVALID_REPEATER_VALIDATION");
    }
}
function isSupportedTopLevelType(value) {
    return SUPPORTED_TOP_LEVEL_TYPES.includes(value);
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function compareFieldIdentity(a, b) {
    return compareStrings(a.slug, b.slug);
}
function compareStrings(a, b) {
    return a < b ? -1 : a > b ? 1 : 0;
}
