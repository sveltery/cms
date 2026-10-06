// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// Complete pinned page resolver bodies, native generic component type transport.
function togglePagePathTrailingSlash(path: string): string {
	if (path === "/") return path;
	return path.endsWith("/") ? path.slice(0, -1) : `${path}/`;
}

/**
 * Resolve a plugin page component by path, treating a trailing slash as equivalent and falling back to the first registered page at the root
 */
export function resolvePluginPagePath<T>(
	pages: Record<string, T> | undefined,
	path: string,
): T | null {
	if (!pages) return null;
	const match = pages[path] ?? pages[togglePagePathTrailingSlash(path)];
	if (match) return match;
	// The Plugin Manager gear opens a plugin at "/plugins/<id>/", so the root
	// falls back to the first registered page when no page is keyed at "/".
	if (path === "/") return Object.values(pages)[0] ?? null;
	return null;
}

