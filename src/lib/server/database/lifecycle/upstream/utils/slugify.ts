// EmDash 1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; source blob 9872f3b9d2905dc1b4cd010347eed375ddeadf47.
// Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
// Host adaptations: .ts module specifiers, CMS table namespace, erasable parameter properties.
export { slugify } from "../admin-slugify.ts";

/**
 * Decode a URI-encoded slug parameter.
 *
 * Browsers percent-encode non-ASCII characters in URLs, so a slug like
 * "మేష-రాసి" arrives as "%e0%b0%ae%e0%b1%87%e0%b0%b7-%e0%b0%b0%e0%b0%be%e0%b0%b8%e0%b0%bf".
 * Call this on `Astro.params.slug` before using it in database lookups.
 */
export function decodeSlug(raw: string | undefined): string | undefined {
	return raw ? decodeURIComponent(raw) : undefined;
}
