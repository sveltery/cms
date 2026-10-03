// Complete pinned helper; MIT notice in notices/emdash-MIT.txt.
export function normalizeCropMime(mimeType: string): string {
	const normalized = mimeType.split(";")[0]!.trim().toLowerCase();
	return normalized === "image/jpg" ? "image/jpeg" : normalized;
}
