// EmDash 1.1.0 MIT, Copyright 2026 Cloudflare Inc.; see notices/emdash-MIT.txt.
// Complete cursorPaginationQuery declaration from 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e:packages/core/src/api/schemas/common.ts.
import { z } from "zod";

export const cursorPaginationQuery = z
	.object({
		cursor: z.string().max(2048).optional().meta({ description: "Opaque cursor for pagination" }),
		limit: z.coerce.number().int().min(1).max(100).optional().default(50).meta({
			description: "Maximum number of items to return (1-100, default 50)",
		}),
	})
	.meta({ id: "CursorPaginationQuery" });
