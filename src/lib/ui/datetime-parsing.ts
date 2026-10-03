// Ported from EmDash 1.1.0, MIT Copyright 2026 Cloudflare Inc.
// Pin 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; see notices/emdash-MIT.txt.
const NAIVE_DATETIME_PATTERN = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/;
const TIMEZONE_DESIGNATOR_PATTERN = /(?:[zZ]|[+-]\d\d(?::?\d\d)?)$/;

export function parseTimestamp(value: string): Date {
	const hasTime = NAIVE_DATETIME_PATTERN.test(value);
	const hasZone = TIMEZONE_DESIGNATOR_PATTERN.test(value);
	if (hasTime && !hasZone) {
		return new Date(value.replace(" ", "T") + "Z");
	}
	return new Date(value);
}
