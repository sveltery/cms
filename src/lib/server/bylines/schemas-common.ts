// EmDash 1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e.
// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// Whole route bodies with native context/imports; optional configured hook seam.
import {z} from "zod";
export {localeCode} from "../menus/schema-common.ts";
export const cursorPaginationQuery = z
	.object({
		cursor: z.string().max(2048).optional().meta({ description: "Opaque cursor for pagination" }),
		limit: z.coerce.number().int().min(1).max(100).optional().default(50).meta({
			description: "Maximum number of items to return (1-100, default 50)",
		}),
	})
	.meta({ id: "CursorPaginationQuery" });

/** Matches http(s) scheme at start of URL */
const HTTP_SCHEME_RE = /^https?:\/\//i;

/** Validates that a URL string uses http or https scheme. Rejects javascript:/data: URI XSS vectors. */
export const httpUrl = z
	.url()
	.refine((url) => HTTP_SCHEME_RE.test(url), "URL must use http or https");

