/**
 * Split an array into chunks of at most `size` elements.
 *
 * Used to keep SQL `IN (?, ?, …)` clauses within Cloudflare D1's
 * bound-parameter limit (~100 per statement).
 */
export function chunks(arr, size) {
    if (arr.length === 0)
        return [];
    const result = [];
    for (let i = 0; i < arr.length; i += size) {
        result.push(arr.slice(i, i + size));
    }
    return result;
}
/** Conservative default chunk size for SQL IN clauses (well within D1's limit). */
export const SQL_BATCH_SIZE = 50;
