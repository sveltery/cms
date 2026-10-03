// EmDash 1.1.0 MIT, Copyright 2026 Cloudflare Inc.; see notices/emdash-MIT.txt.
// Source 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e:packages/core/src/i18n/resolve.ts; blob dcaea830fdeb480be623f7aa88e8942b1e4a1811.
const REPEATED_SLASHES = /\/{2,}/g;
const TRAILING_SLASH = /\/$/;
const DATE_TOKEN = /\{(year|month|day|hour|minute|second)\}/g;
// SQLite-style datetime without timezone info ("2023-05-08 10:00:00").
// Stored values are UTC; without this, `new Date()` would parse them in the
// server's local zone and the same row could yield different URLs per host.
const OFFSETLESS_DATETIME = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)$/;
const pad2 = (n: number) => String(n).padStart(2, "0");

function parseUtcDate(date: string | Date): Date {
	if (date instanceof Date) return date;
	const offsetless = OFFSETLESS_DATETIME.exec(date);
	return new Date(offsetless ? `${offsetless[1]}T${offsetless[2]}Z` : date);
}

/**
 * Substitute WordPress-style date tokens (`{year}`, `{month}`, `{day}`,
 * `{hour}`, `{minute}`, `{second}`) from a publish date. Month/day/time parts
 * are zero-padded, mirroring WordPress (`%monthnum%`, `%day%`, ...). Tokens are
 * left untouched when no valid date is available, so callers without a date
 * (or unpublished entries) never produce a half-resolved URL.
 */
function applyDateTokens(path: string, date: string | Date | null | undefined): string {
	const d = date == null ? null : parseUtcDate(date);
	if (!d || Number.isNaN(d.getTime())) return path;
	const parts: Record<string, string> = {
		year: String(d.getUTCFullYear()),
		month: pad2(d.getUTCMonth() + 1),
		day: pad2(d.getUTCDate()),
		hour: pad2(d.getUTCHours()),
		minute: pad2(d.getUTCMinutes()),
		second: pad2(d.getUTCSeconds()),
	};
	return path.replace(DATE_TOKEN, (match, key: string) => parts[key] ?? match);
}

/**
 * Interpolate a collection `url_pattern` with a row's slug, id and publish date.
 *
 * Supported tokens: `{slug}`, `{id}`, and the date tokens `{year}`,
 * `{month}`, `{day}`, `{hour}`, `{minute}`, `{second}` (resolved from `date`,
 * for WordPress-style permalinks like `/{year}/{month}/{day}/{slug}.html`).
 *
 * Falls back to `/{collection}/{slug}` when no pattern is configured.
 * Does NOT apply any locale prefix — pass the result through
 * Astro's `getRelativeLocaleUrl` / `getAbsoluteLocaleUrl` (or the
 * `localizePath` helper below) to add the locale segment.
 */
export function interpolateUrlPattern(options: {
	pattern: string | null;
	collection: string;
	slug: string;
	id: string;
	/** Publish date used for date tokens; tokens stay literal when absent. */
	date?: string | Date | null;
}): string {
	const { pattern, collection, slug, id, date } = options;
	const basePattern = pattern ?? `/${encodeURIComponent(collection)}/{slug}`;
	let path = basePattern
		.replaceAll("{slug}", encodeURIComponent(slug))
		.replaceAll("{id}", encodeURIComponent(id));
	path = applyDateTokens(path, date);
	path = path.replace(REPEATED_SLASHES, "/");
	if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
	if (!path.startsWith("/")) path = `/${path}`;
	return path;
}

