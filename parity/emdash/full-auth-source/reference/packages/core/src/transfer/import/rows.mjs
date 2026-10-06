/**
 * Record ↔ row helpers for the importer over the shared column codec
 * (`format/column-codec.ts`).
 *
 * Stored rows are compared with the rows the importer meant to write after
 * decoding both sides with the same codec, so dialect differences (Postgres
 * `json` columns returning parsed values, `bigint` strings) do not register as
 * mismatches. Postgres stores REAL columns as float4, so REAL values are
 * compared after `Math.fround` there.
 */
import { isPostgres } from "../../database/dialect-helpers.js";
import { isTransferError, TransferError } from "../errors.js";
import { canonicalJson } from "../format/canonical.js";
import { decodeColumn, encodeColumn } from "../format/column-codec.js";
/** Codecs of the columns a record carries (`field`, `principal`, `mediaRef`). */
export function recordCodecs(columns) {
    const codecs = {};
    for (const [column, spec] of Object.entries(columns)) {
        if ("property" in spec)
            codecs[column] = spec.codec;
    }
    return codecs;
}
/**
 * The row for `record` over every column the record carries. `record` must
 * already be in target form: placeholders resolved and principals mapped.
 */
export function encodeRecord(db, columns, record, location) {
    const row = {};
    for (const [column, spec] of Object.entries(columns)) {
        if (!("property" in spec))
            continue;
        row[column] = encodeValue(db, spec.codec, Object.hasOwn(record, spec.property) ? record[spec.property] : undefined, { ...location, column });
    }
    return row;
}
/** `encodeColumn`, with the record and column named in a failure. */
export function encodeValue(db, codec, value, location, options = {}) {
    try {
        return encodeColumn(db, codec, value, options);
    }
    catch (error) {
        if (!isTransferError(error))
            throw error;
        throw new TransferError(error.code, "Record value does not fit its target column", {
            detail: { ...location, ...error.detail },
            cause: error,
        });
    }
}
function comparable(db, codec, raw, options) {
    const stored = options.encoded && codec === "nativeJson" && isPostgres(db) && typeof raw === "string"
        ? JSON.parse(raw)
        : raw;
    const value = decodeColumn(db, codec, stored);
    if (value === undefined)
        return undefined;
    if (options.float4 && codec === "real" && typeof value === "number") {
        return canonicalJson(Math.fround(value));
    }
    return canonicalJson(value);
}
/**
 * The first column (in `codecs` order) where the stored row differs from the
 * row the importer encoded, or null when they are equal over those columns.
 * Postgres returns `json` columns parsed, so an encoded `nativeJson` value is
 * parsed before it is compared.
 */
export function firstDifference(db, codecs, encoded, stored, options) {
    for (const [column, codec] of Object.entries(codecs)) {
        const want = comparable(db, codec, encoded[column], { ...options, encoded: true });
        const have = comparable(db, codec, stored[column], { ...options, encoded: false });
        if (want !== have)
            return column;
    }
    return null;
}
