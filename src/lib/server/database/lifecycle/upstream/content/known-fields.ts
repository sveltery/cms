// EmDash 1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; source blob 8fcc3c9a45bad4a664459a0ae753bbb1699bddfd.
// Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
// Host adaptations: .ts module specifiers, CMS table namespace, erasable parameter properties.
/**
 * Reconcile an entry's keys with the fields its collection currently declares.
 *
 * A draft revision stores the whole `data` as JSON, so deleting a field leaves the old
 * value inside the revision. Every content-write surface needs the same two rules to keep
 * that from stranding the entry, so they live here rather than in one caller.
 */

/** Keys EmDash reserves (`_slug` and the like). No field declares them. */
function isReservedKey(key: string): boolean {
	return key.startsWith("_");
}

/**
 * The entry data without the keys the collection has no field for.
 *
 * Reserved keys are kept.
 */
export function keepKnownFields(
	data: Record<string, unknown>,
	knownFieldSlugs: ReadonlySet<string>,
): Record<string, unknown> {
	const result: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(data)) {
		if (isReservedKey(key) || knownFieldSlugs.has(key)) result[key] = value;
	}
	return result;
}

/**
 * Incoming keys with no matching field that the entry already stores.
 *
 * Dropping these lets a read-then-write save succeed after the field was deleted. A key the
 * entry has never stored is not returned, so a genuinely unknown field is still reported.
 */
export function staleStoredKeys(
	data: Record<string, unknown>,
	stored: Record<string, unknown>,
	knownFieldSlugs: ReadonlySet<string>,
): string[] {
	return Object.keys(data).filter(
		(key) => !isReservedKey(key) && !knownFieldSlugs.has(key) && Object.hasOwn(stored, key),
	);
}
