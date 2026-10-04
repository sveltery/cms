// EmDash 1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; whole Source packages/core/src/utils/chunks.ts.
// Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
// Host adaptations are explicitly inventoried in the block registry proposal.
/**
 * Split an array into chunks of at most `size` elements.
 *
 * Used to keep SQL `IN (?, ?, …)` clauses within Cloudflare D1's
 * bound-parameter limit (~100 per statement).
 */
export function chunks<T>(arr: T[], size: number): T[][] {
	if (arr.length === 0) return [];
	const result: T[][] = [];
	for (let i = 0; i < arr.length; i += size) {
		result.push(arr.slice(i, i + size));
	}
	return result;
}

/** Conservative default chunk size for SQL IN clauses (well within D1's limit). */
export const SQL_BATCH_SIZE = 50;
