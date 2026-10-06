// EmDash1.1.0 immutable913cb1bb9b7f08c3ff0d258b4420e53835b6a58e:
// complete cursorPaginationQuery declaration in packages/core/src/api/schemas/common.ts.
// Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
import { z } from 'zod';
/** Pagination query params — cursor-based */
export const cursorPaginationQuery = z
  .object({
    cursor: z.string().max(2048).optional().meta({ description: 'Opaque cursor for pagination' }),
    limit: z.coerce.number().int().min(1).max(100).optional().default(50).meta({
      description: 'Maximum number of items to return (1-100, default 50)',
    }),
  })
  .meta({ id: 'CursorPaginationQuery' });
