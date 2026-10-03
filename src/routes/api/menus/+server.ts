// Native SvelteKit hosting of pinned EmDash menu REST handlers.
// EmDash 1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
import type { RequestHandler } from '@sveltejs/kit';
import { withMenuRequest } from '../../../lib/server/menus/http.ts';
import { handleMenuList, handleMenuCreate } from '../../../lib/server/menus/handlers.ts';
import { parseBody, parseQuery, isParseError } from '../../../lib/server/menus/parse.ts';
import { unwrapResult, apiError } from '../../../lib/server/menus/http-errors.ts';
import { localeFilterQuery } from '../../../lib/server/menus/schema-common.ts';
import { createMenuBody } from '../../../lib/server/menus/schemas.ts';

export const prerender = false;

export const GET: RequestHandler = event => withMenuRequest(event, false, 'MENU_LIST_ERROR', 'Failed to fetch menus', async db => {
  const query = parseQuery(event.url, localeFilterQuery); if (isParseError(query)) return query;
  return unwrapResult(await handleMenuList(db, { locale: query.locale }));
});
export const POST: RequestHandler = event => withMenuRequest(event, true, 'MENU_CREATE_ERROR', 'Failed to create menu', async db => {
  const body = await parseBody(event.request, createMenuBody); if (isParseError(body)) return body;
  return unwrapResult(await handleMenuCreate(db, body), 201);
});
