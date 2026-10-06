/**
 * Parameter-bounded multi-row statements over tables named at runtime.
 *
 * Table and column names come from the column registry or from validated
 * collection and field slugs; every value is a bound parameter. Each
 * statement binds at most `TRANSFER_LIMITS.d1BindParameters` values.
 */
import { sql } from "kysely";
import { validateIdentifier } from "../../database/validate.js";
import { chunks } from "../../utils/chunks.js";
import { rowsPerInsert, TRANSFER_LIMITS } from "../format/limits.js";
const TABLE_NAME = /^_?[a-z][a-z0-9_]*$/;
function tableRef(table) {
    if (!TABLE_NAME.test(table))
        throw new Error(`Invalid table name ${table}`);
    return sql.ref(table);
}
function columnRef(column) {
    validateIdentifier(column, "column");
    return sql.ref(column);
}
/**
 * Insert `rows` (all with exactly `columns`) in statements of at most
 * `rowsPerInsert(columns.length)` rows. Returns the number of rows the
 * statements inserted or updated.
 */
export async function insertRows(db, table, columns, rows, conflict = { type: "nothing" }) {
    const perStatement = rowsPerInsert(columns.length);
    if (perStatement === 0)
        throw new Error(`Too many columns for one insert into ${table}`);
    const columnList = sql.join(columns.map(columnRef));
    const onConflict = conflict.type === "nothing"
        ? sql `ON CONFLICT DO NOTHING`
        : sql `ON CONFLICT (${sql.join(conflict.target.map(columnRef))}) DO UPDATE SET ${sql.join(conflict.update.map((column) => sql `${columnRef(column)} = excluded.${columnRef(column)}`))}`;
    let written = 0;
    for (const batch of chunks([...rows], perStatement)) {
        const values = sql.join(batch.map((row) => sql `(${sql.join(columns.map((column) => row[column] ?? null))})`));
        const result = await sql `INSERT INTO ${tableRef(table)} (${columnList}) VALUES ${values} ${onConflict}`.execute(db);
        written += Number(result.numAffectedRows ?? 0n);
    }
    return written;
}
/** Rows of `table` whose `keyColumns` equal one of `keys`. */
export async function selectByKeys(db, table, keyColumns, keys) {
    const perStatement = Math.max(1, Math.floor(TRANSFER_LIMITS.d1BindParameters / keyColumns.length));
    const result = [];
    for (const batch of chunks([...keys], perStatement)) {
        const [only] = keyColumns;
        const where = keyColumns.length === 1 && only !== undefined
            ? sql `${columnRef(only)} IN (${sql.join(batch.map((key) => key[only] ?? null))})`
            : sql.join(batch.map((key) => sql `(${sql.join(keyColumns.map((column) => sql `${columnRef(column)} = ${key[column] ?? null}`), sql ` AND `)})`), sql ` OR `);
        const rows = await sql `SELECT * FROM ${tableRef(table)} WHERE ${where}`.execute(db);
        result.push(...rows.rows);
    }
    return result;
}
/**
 * Set `columns` of the row whose `keyColumn` equals `key`, in statements of
 * at most `d1BindParameters - 1` columns.
 */
export async function updateColumns(db, table, keyColumn, key, row, columns) {
    let statements = 0;
    for (const batch of chunks([...columns], TRANSFER_LIMITS.d1BindParameters - 1)) {
        const assignments = sql.join(batch.map((column) => sql `${columnRef(column)} = ${row[column] ?? null}`));
        await sql `UPDATE ${tableRef(table)} SET ${assignments} WHERE ${columnRef(keyColumn)} = ${key}`.execute(db);
        statements++;
    }
    return statements;
}
/** Statements `insertRows` + `selectByKeys` need for `count` rows. */
export function estimateStatements(count, columns, keyColumns = 1) {
    const perInsert = Math.max(1, rowsPerInsert(columns));
    const perSelect = Math.max(1, Math.floor(TRANSFER_LIMITS.d1BindParameters / keyColumns));
    return Math.ceil(count / perInsert) + Math.ceil(count / perSelect);
}
