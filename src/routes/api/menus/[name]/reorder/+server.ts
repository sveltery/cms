// Native SvelteKit hosting of pinned EmDash menu REST handlers.
// EmDash 1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
import type { RequestHandler } from '@sveltejs/kit';
import { withMenuRequest } from '../../../../../lib/server/menus/http.ts';
import { handleMenuItemReorder } from '../../../../../lib/server/menus/handlers.ts';
import { parseBody, parseQuery, isParseError } from '../../../../../lib/server/menus/parse.ts';
import { unwrapResult, apiError } from '../../../../../lib/server/menus/http-errors.ts';
import { localeFilterQuery } from '../../../../../lib/server/menus/schema-common.ts';
import { reorderMenuItemsBody } from '../../../../../lib/server/menus/schemas.ts';

export const prerender = false;

export const POST: RequestHandler = event => withMenuRequest(event, true, 'MENU_REORDER_ERROR', 'Failed to reorder menu items', async db => {
  const query = parseQuery(event.url, localeFilterQuery); if (isParseError(query)) return query;
  const body = await parseBody(event.request, reorderMenuItemsBody); if (isParseError(body)) return body;
  return unwrapResult(await handleMenuItemReorder(db, event.params.name!, body.items, { locale: query.locale }));
});
