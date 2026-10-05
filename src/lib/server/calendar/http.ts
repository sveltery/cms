// EmDash1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e: packages/core/src/astro/routes/api/calendar.ts.
// Copyright2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
import type { RequestEvent } from '@sveltejs/kit';
import { requirePerm } from '../sections-widgets/api/authorize.ts';
import { apiError, handleError, unwrapResult } from '../sections-widgets/api/error.ts';
import { isParseError, parseQuery } from '../sections-widgets/api/parse.ts';
import { handleCalendarEntries } from './handlers.ts';
import { calendarQuery } from './schema.ts';

/** Current trusted request locals only; never opens or migrates storage. */
export async function calendarGet({ url, locals }: Pick<RequestEvent, 'url' | 'locals'>): Promise<Response> {
  const context = locals.cms;
  const denied = requirePerm(context?.principal, 'content:read_drafts');
  if (denied) return denied;
  if (!context?.database) return apiError('NOT_CONFIGURED', 'Content storage is not configured', 500);
  const query = parseQuery(url, calendarQuery);
  if (isParseError(query)) return query;
  try { return unwrapResult(await handleCalendarEntries(context.database.db as any, query)); }
  catch (error) { return handleError(error, 'Failed to load calendar', 'CALENDAR_ERROR'); }
}
