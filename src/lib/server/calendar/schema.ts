// EmDash1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e: packages/core/src/api/schemas/common.ts + packages/core/src/api/schemas/content.ts.
// Copyright2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
import { z } from "zod";

// Whole pinned content.ts contentDateTime union, reused by the Native envelope.
export const contentDateTime = z.iso
	.datetime({ offset: true, message: "must be an ISO 8601 datetime" })
	.or(
		z.iso.datetime({
			offset: true,
			precision: -1,
			message: "must be an ISO 8601 datetime",
		}),
	);

export const cursorPaginationQuery = z
	.object({
		cursor: z.string().max(2048).optional().meta({ description: "Opaque cursor for pagination" }),
		limit: z.coerce.number().int().min(1).max(100).optional().default(50).meta({
			description: "Maximum number of items to return (1-100, default 50)",
		}),
	})
	.meta({ id: "CursorPaginationQuery" });

const MAX_CALENDAR_RANGE_MS = 62 * 24 * 60 * 60 * 1000;

/** Canonical UTC form, so bounds compare as text against stored timestamps. */
const calendarBound = z.iso
	.datetime({ offset: true, message: "must be an ISO 8601 datetime" })
	.transform((value) => new Date(value).toISOString());

/** Calendar range: `from` inclusive, `to` exclusive, at most 62 days apart. */
export const calendarQuery = cursorPaginationQuery
	.extend({ from: calendarBound, to: calendarBound })
	.refine((query) => query.from < query.to, { message: "to must be after from", path: ["to"] })
	.refine((query) => Date.parse(query.to) - Date.parse(query.from) <= MAX_CALENDAR_RANGE_MS, {
		message: "the range can span at most 62 days",
		path: ["to"],
	});
