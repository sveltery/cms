import { DatetimeNormalizationError, normalizeContentDatetimes, normalizeDatetime, } from "../datetime-normalization.js";
import { requestCached } from "../request-cache.js";
import { isStoragelessFieldRow } from "../schema/types.js";
import { isSafeUrlFieldWriteValue } from "../utils/url.js";
import { EmDashValidationError } from "./repositories/types.js";
function repeaterSubFieldsOfType(validation, type) {
    if (!validation)
        return [];
    let parsed;
    try {
        parsed = JSON.parse(validation);
    }
    catch {
        return [];
    }
    if (typeof parsed !== "object" || parsed === null || !("subFields" in parsed))
        return [];
    const subFields = parsed.subFields;
    if (!Array.isArray(subFields))
        return [];
    return subFields
        .filter((field) => typeof field === "object" &&
        field !== null &&
        "type" in field &&
        field.type === type &&
        "slug" in field &&
        typeof field.slug === "string")
        .map((field) => field.slug);
}
export class ContentDatetimeNormalizer {
    db;
    contexts;
    constructor(db, contexts) {
        this.db = db;
        this.contexts = contexts;
    }
    context(collection) {
        if (this.contexts) {
            let context = this.contexts.get(collection);
            if (!context) {
                context = this.loadContext(collection);
                this.contexts.set(collection, context);
            }
            return context;
        }
        // Fall back to the per-request cache so repeated writes in the same
        // invocation (e.g. bulk imports) do not re-query field/timezone metadata
        // for every item.
        return requestCached(`datetimeContext:${collection}`, () => this.loadContext(collection));
    }
    async loadContext(collection) {
        const [rows, timezoneRow] = await Promise.all([
            this.db
                .selectFrom("_emdash_fields as field")
                .innerJoin("_emdash_collections as collection", "collection.id", "field.collection_id")
                .select(["field.slug", "field.type", "field.validation"])
                .where("collection.slug", "=", collection)
                .execute(),
            this.db
                .selectFrom("options")
                .select("value")
                .where("name", "=", "site:timezone")
                .executeTakeFirst(),
        ]);
        let timezone = "UTC";
        if (timezoneRow) {
            try {
                const configured = JSON.parse(timezoneRow.value);
                if (typeof configured === "string" && configured)
                    timezone = configured;
            }
            catch {
                // The datetime normalizer reports an invalid timezone when it encounters a value.
            }
        }
        const fields = [];
        const urlFields = [];
        for (const row of rows) {
            if (row.type === "datetime") {
                fields.push({ slug: row.slug, type: "datetime" });
            }
            else if (row.type === "url") {
                urlFields.push({ slug: row.slug });
            }
            else if (row.type === "repeater") {
                fields.push({
                    slug: row.slug,
                    type: "repeater",
                    datetimeSubFields: repeaterSubFieldsOfType(row.validation, "datetime"),
                });
                const urlSubFields = repeaterSubFieldsOfType(row.validation, "url");
                if (urlSubFields.length > 0)
                    urlFields.push({ slug: row.slug, urlSubFields });
            }
        }
        const writableFieldSlugs = new Set(rows.filter((field) => !isStoragelessFieldRow(field)).map((field) => field.slug));
        return { timezone, fields, urlFields, writableFieldSlugs };
    }
    async writableFieldSlugs(collection) {
        return (await this.context(collection)).writableFieldSlugs;
    }
    /**
     * Normalizes datetimes in incoming field values and rejects `url` values
     * with unsafe schemes, control characters, or off-site path forms. Values
     * already stored are not checked, so restoring or syncing existing data
     * goes through {@link normalizeData} instead.
     */
    async normalizeInput(collection, data) {
        const context = await this.context(collection);
        assertSafeUrlFields(data, context.urlFields);
        return this.normalizeWithContext(context, [data])[0] ?? data;
    }
    async normalizeData(collection, data) {
        const [normalized] = await this.normalizeDataMany(collection, [data]);
        return normalized ?? data;
    }
    async normalizeDataMany(collection, items) {
        return this.normalizeWithContext(await this.context(collection), items);
    }
    normalizeWithContext(context, items) {
        try {
            return items.map((data) => normalizeContentDatetimes(data, context.fields, context.timezone).value);
        }
        catch (error) {
            if (error instanceof DatetimeNormalizationError) {
                throw new EmDashValidationError(error.message);
            }
            throw error;
        }
    }
    async normalizeValue(collection, value) {
        const context = await this.context(collection);
        try {
            return normalizeDatetime(value, context.timezone).value;
        }
        catch (error) {
            if (error instanceof DatetimeNormalizationError) {
                throw new EmDashValidationError(error.message);
            }
            throw error;
        }
    }
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
// Reads parse a stored string that looks like JSON, so a repeater written as a JSON string
// comes back as rows and must be checked as rows.
function repeaterRows(value) {
    let rows = value;
    if (typeof rows === "string" && rows.startsWith("[")) {
        try {
            rows = JSON.parse(rows);
        }
        catch {
            return undefined;
        }
    }
    return Array.isArray(rows) ? rows : undefined;
}
function assertSafeUrl(path, value) {
    if (typeof value === "string" && !isSafeUrlFieldWriteValue(value)) {
        throw new EmDashValidationError(`Field "${path}" must use http, https, mailto, or tel, or be a safe relative path or fragment`, { path });
    }
}
function assertSafeUrlFields(data, urlFields) {
    for (const field of urlFields) {
        const value = data[field.slug];
        if (!field.urlSubFields) {
            assertSafeUrl(field.slug, value);
            continue;
        }
        const rows = repeaterRows(value);
        if (!rows)
            continue;
        for (const [index, row] of rows.entries()) {
            if (!isRecord(row))
                continue;
            for (const subField of field.urlSubFields) {
                assertSafeUrl(`${field.slug}.${index}.${subField}`, row[subField]);
            }
        }
    }
}
