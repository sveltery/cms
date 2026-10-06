/**
 * Database-clock timestamps for transfer state. Every lease and expiry
 * comparison runs in SQL against the database clock, never a worker clock,
 * and every stored timestamp uses the sortable `YYYY-MM-DDTHH:MM:SS.sssZ`
 * form so plain string comparison orders them.
 */
import { sql } from "kysely";
import { isPostgres } from "../../database/dialect-helpers.js";
export function timestampOffset(db, seconds) {
    if (!Number.isFinite(seconds))
        throw new RangeError("Invalid timestamp offset");
    if (isPostgres(db)) {
        return sql `to_char(
			clock_timestamp() AT TIME ZONE 'UTC' + (${seconds} * interval '1 second'),
			'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
		)`;
    }
    return sql `strftime('%Y-%m-%dT%H:%M:%fZ', 'now', ${`${seconds >= 0 ? "+" : ""}${seconds} seconds`})`;
}
export function timestampNow(db) {
    return timestampOffset(db, 0);
}
/** `column <= now` */
export function timestampIsDue(db, column) {
    return isPostgres(db)
        ? sql `${sql.ref(column)}::timestamptz <= clock_timestamp()`
        : sql `${sql.ref(column)} <= strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`;
}
/** `column > now` */
export function timestampIsLive(db, column) {
    return isPostgres(db)
        ? sql `${sql.ref(column)}::timestamptz > clock_timestamp()`
        : sql `${sql.ref(column)} > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`;
}
/** `column <= now - seconds` */
export function timestampIsOlderThan(db, column, seconds) {
    if (!Number.isFinite(seconds) || seconds < 0)
        throw new RangeError("Invalid timestamp age");
    return isPostgres(db)
        ? sql `${sql.ref(column)}::timestamptz <= clock_timestamp() - (${seconds} * interval '1 second')`
        : sql `${sql.ref(column)} <= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', ${`-${seconds} seconds`})`;
}
