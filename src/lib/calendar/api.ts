// EmDash1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e: packages/admin/src/lib/api/calendar.ts + packages/admin/src/lib/api/client.ts:retry predicate.
// Copyright2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
// Native API base/CSRF/error transport reuses the existing public client.
// Lingui descriptor compiled with the actual public macro plugin; no query cache is created.
/**
 * Calendar API
 */

import { i18n } from "@lingui/core";
import { queryOptions } from "@tanstack/react-query";

import { API_BASE, apiFetch, ApiResponseError, parseApiResponse } from "../sections-widgets/client.ts";

/**
 * Client errors that pass no verdict on the request body, so resending it
 * unchanged can still succeed. Every other 4xx repeats its verdict on every
 * attempt.
 */
const RETRYABLE_CLIENT_ERROR_STATUSES: ReadonlySet<number> = new Set([
	408, // Request Timeout: the server gave up waiting for the request
	421, // Misdirected Request: another connection can be routed correctly
	425, // Too Early: sent as TLS early data, replayable after the handshake
	429, // Too Many Requests: succeeds once the rate limit window has passed
]);

/** Whether retrying the same request unchanged can never succeed. */
export function isTerminalRequestError(error: unknown): boolean {
	if (!(error instanceof ApiResponseError)) return false;
	return (
		error.status >= 400 && error.status < 500 && !RETRYABLE_CLIENT_ERROR_STATUSES.has(error.status)
	);
}

export interface CalendarEntry {
	collection: string;
	id: string;
	locale: string;
	title: string;
	/** The entry's current status. */
	status: string;
	/** `published` events sit at `published_at`, `scheduled` events at `scheduled_at`. */
	kind: "published" | "scheduled";
	at: string;
}

export interface CalendarPage {
	items: CalendarEntry[];
	nextCursor?: string;
}

export interface CalendarRange {
	items: CalendarEntry[];
	/** More events exist than the page cap allows the calendar to load. */
	truncated: boolean;
}

const PAGE_SIZE = 100;
const MAX_PAGES = 10;
export const CALENDAR_MAX_ENTRIES = PAGE_SIZE * MAX_PAGES;

export async function fetchCalendarPage(
	params: { from: string; to: string; cursor?: string },
	signal?: AbortSignal,
): Promise<CalendarPage> {
	const search = new URLSearchParams({
		from: params.from,
		to: params.to,
		limit: String(PAGE_SIZE),
	});
	if (params.cursor) search.set("cursor", params.cursor);
	const response = await apiFetch(`${API_BASE}/calendar?${search.toString()}`, { signal });
	return parseApiResponse<CalendarPage>(response, i18n._({ id: "s2+GNH", message: "Failed to load the calendar" }));
}

export function calendarEntryKey(entry: Pick<CalendarEntry, "collection" | "id" | "kind">): string {
	return `${entry.collection}:${entry.id}:${entry.kind}`;
}

/**
 * Loads every event in the range, up to the page cap. Entries rescheduled
 * while the pages load can come back twice, so repeats are dropped.
 */
export async function fetchCalendarRange(
	from: string,
	to: string,
	signal?: AbortSignal,
): Promise<CalendarRange> {
	const items: CalendarEntry[] = [];
	const seen = new Set<string>();
	let cursor: string | undefined;
	for (let page = 0; page < MAX_PAGES; page++) {
		// oxlint-disable-next-line no-await-in-loop -- each page needs the previous cursor
		const result = await fetchCalendarPage({ from, to, cursor }, signal);
		for (const item of result.items) {
			const key = calendarEntryKey(item);
			if (seen.has(key)) continue;
			seen.add(key);
			items.push(item);
		}
		cursor = result.nextCursor;
		if (!cursor) return { items, truncated: false };
	}
	return { items, truncated: true };
}

export function calendarQueryOptions(from: string, to: string) {
	return queryOptions({
		queryKey: ["calendar", from, to] as const,
		queryFn: ({ signal }) => fetchCalendarRange(from, to, signal),
		retry: (failureCount, error) => !isTerminalRequestError(error) && failureCount < 1,
	});
}
