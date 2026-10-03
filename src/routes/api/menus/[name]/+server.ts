// Native SvelteKit hosting of pinned EmDash menu REST handlers.
// EmDash 1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
import type { RequestHandler } from '@sveltejs/kit';
import { withMenuRequest } from '../../../../lib/server/menus/http.ts';
import { handleMenuGet, handleMenuUpdate, handleMenuDelete } from '../../../../lib/server/menus/handlers.ts';
import { parseBody, parseQuery, isParseError } from '../../../../lib/server/menus/parse.ts';
import { unwrapResult, apiError } from '../../../../lib/server/menus/http-errors.ts';
import { localeFilterQuery } from '../../../../lib/server/menus/schema-common.ts';
import { updateMenuBody } from '../../../../lib/server/menus/schemas.ts';

export const prerender = false;

export const GET: RequestHandler = event => withMenuRequest(event, false, 'MENU_GET_ERROR', 'Failed to fetch menu', async db => {
  const query = parseQuery(event.url, localeFilterQuery); if (isParseError(query)) return query;
  return unwrapResult(await handleMenuGet(db, event.params.name!, { locale: query.locale }));
});
export const PUT: RequestHandler = event => withMenuRequest(event, true, 'MENU_UPDATE_ERROR', 'Failed to update menu', async db => {
  const query = parseQuery(event.url, localeFilterQuery); if (isParseError(query)) return query;
  const body = await parseBody(event.request, updateMenuBody); if (isParseError(body)) return body;
  return unwrapResult(await handleMenuUpdate(db, event.params.name!, { ...body, locale: query.locale }));
});
export const DELETE: RequestHandler = event => withMenuRequest(event, true, 'MENU_DELETE_ERROR', 'Failed to delete menu', async db => {
  const query = parseQuery(event.url, localeFilterQuery); if (isParseError(query)) return query;
  return unwrapResult(await handleMenuDelete(db, event.params.name!, { locale: query.locale }));
});
