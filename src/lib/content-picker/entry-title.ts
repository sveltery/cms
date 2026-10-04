// EmDash1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e. Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
/**
 * The title to show for a content entry. Uses the collection's `titleField`
 * if set and non-empty, otherwise falls back to `title → name → slug → id`.
 * Shared so every surface (list, picker, editor) shows the same title.
 */
export function getEntryTitle(
	item: { data: Record<string, unknown>; slug: string | null; id: string },
	titleField?: string,
): string {
	const preferred = titleField ? item.data[titleField] : undefined;
	const rawTitle = item.data.title;
	const rawName = item.data.name;
	return (
		(typeof preferred === "string" ? preferred : "") ||
		(typeof rawTitle === "string" ? rawTitle : "") ||
		(typeof rawName === "string" ? rawName : "") ||
		item.slug ||
		item.id
	);
}
