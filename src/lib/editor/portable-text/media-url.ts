// Ported from EmDash 1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e.
// Source: packages/admin/src/lib/media-utils.ts
// MIT license: notices/emdash-MIT.txt.



export function canonicalMediaProviderId(provider: string | undefined): string {
	if (!provider) return "local";
	return provider === "external-url" ? "external" : provider;
}

/** Root-absolute path prefix for locally stored media served by EmDash. */
const INTERNAL_MEDIA_PREFIX = "/_emdash/api/media/file/";

/**
 * URL of the local media file route for a storage key or media ID.
 *
 * Keys can contain `/` (an existing bucket layout such as `2026/08/photo.jpg`), and the
 * `[...key]` route matches them as path segments, so each segment is encoded on its own:
 * `?`, `#` and `%` stay inside the path, but `/` still separates segments. A key with an
 * empty, `.` or `..` segment is encoded whole instead, because the URL parser would
 * collapse those segments (even percent-encoded ones) and move the request off the route;
 * encoded whole, the slashes become `%2F` and no segment is a dot segment any more.
 *
 * That covers slash-delimited traversal only. A key that is exactly `.` or `..` has no
 * representation as a path segment: the parser collapses `%2e` and `%2e%2e` the same way.
 * Neither is a valid storage key.
 */
export function localMediaFileUrl(key: string): string {
	const segments = key.split("/");
	if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
		return `${INTERNAL_MEDIA_PREFIX}${encodeURIComponent(key)}`;
	}
	return `${INTERNAL_MEDIA_PREFIX}${segments.map(encodeURIComponent).join("/")}`;
}
