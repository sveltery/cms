// Native SvelteKit hosting of pinned EmDash menu REST handlers.
// EmDash 1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
import type { RequestHandler } from '@sveltejs/kit';
import { withMenuRequest } from '../../../../../../lib/server/menus/http.ts';
import { handleMenuItemUpdate, handleMenuItemDelete } from '../../../../../../lib/server/menus/handlers.ts';
import { parseBody, parseQuery, isParseError } from '../../../../../../lib/server/menus/parse.ts';
import { unwrapResult, apiError } from '../../../../../../lib/server/menus/http-errors.ts';
import { localeFilterQuery } from '../../../../../../lib/server/menus/schema-common.ts';
import { updateMenuItemBody } from '../../../../../../lib/server/menus/schemas.ts';

export const prerender = false;

export const PUT: RequestHandler = event => withMenuRequest(event, true, 'MENU_ITEM_UPDATE_ERROR', 'Failed to update menu item', async db => {
  if (!event.params.id) return apiError('VALIDATION_ERROR', 'id is required', 400);
  const query = parseQuery(event.url, localeFilterQuery); if (isParseError(query)) return query;
  const body = await parseBody(event.request, updateMenuItemBody); if (isParseError(body)) return body;
  return unwrapResult(await handleMenuItemUpdate(db, event.params.name!, event.params.id, body, { locale: query.locale }));
});
export const DELETE: RequestHandler = event => withMenuRequest(event, true, 'MENU_ITEM_DELETE_ERROR', 'Failed to delete menu item', async db => {
  if (!event.params.id) return apiError('VALIDATION_ERROR', 'id is required', 400);
  const query = parseQuery(event.url, localeFilterQuery); if (isParseError(query)) return query;
  return unwrapResult(await handleMenuItemDelete(db, event.params.name!, event.params.id, { locale: query.locale }));
});
