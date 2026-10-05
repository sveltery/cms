// Exact pinned parseTimestamp/formatRelativeTime bodies from EmDash1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e.
// Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
// Regex patterns for parseTimestamp
const NAIVE_DATETIME_PATTERN = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/;
const TIMEZONE_DESIGNATOR_PATTERN = /(?:[zZ]|[+-]\d\d(?::?\d\d)?)$/;

/**
 * Parse a timestamp string into a Date, treating values without a timezone as UTC.
 *
 * SQLite `datetime('now')` returns `YYYY-MM-DD HH:MM:SS` with no designator, which JavaScript would otherwise read as local time.
 */
export function parseTimestamp(value: string): Date {
	const hasTime = NAIVE_DATETIME_PATTERN.test(value);
	const hasZone = TIMEZONE_DESIGNATOR_PATTERN.test(value);
	if (hasTime && !hasZone) {
		return new Date(value.replace(" ", "T") + "Z");
	}
	return new Date(value);
}

/** "5 minutes ago" in the given locale for the past week, the date after that. */
export function formatRelativeTime(dateString: string, locale: string): string {
	const date = parseTimestamp(dateString);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffSecs = Math.floor(diffMs / 1000);
	const diffMins = Math.floor(diffSecs / 60);
	const diffHours = Math.floor(diffMins / 60);
	const diffDays = Math.floor(diffHours / 24);

	const relativeTime = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
	if (diffSecs < 60) return relativeTime.format(0, "second");
	if (diffMins < 60) return relativeTime.format(-diffMins, "minute");
	if (diffHours < 24) return relativeTime.format(-diffHours, "hour");
	if (diffDays < 7) return relativeTime.format(-diffDays, "day");

	return date.toLocaleDateString(locale, {
		month: "short",
		day: "numeric",
		year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
	});
}
