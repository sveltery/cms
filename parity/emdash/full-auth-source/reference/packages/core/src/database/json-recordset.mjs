import { sql } from "kysely";
import { isPostgres } from "./dialect-helpers.js";
export function jsonTextValues(db, values) {
    const payload = JSON.stringify([...new Set(values)]);
    return isPostgres(db)
        ? sql `SELECT value::text AS value FROM jsonb_array_elements_text(${payload}::jsonb) AS value`
        : sql `SELECT value AS value FROM json_each(${payload})`;
}
