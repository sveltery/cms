// Native SvelteKit hosting of pinned EmDash menu REST handlers.
// EmDash 1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
import type { RequestHandler } from '@sveltejs/kit';
import { withMenuRequest } from '../../../../../lib/server/menus/http.ts';
import { handleMenuGet, handleMenuTranslations, handleMenuCreate } from '../../../../../lib/server/menus/handlers.ts';
import { parseBody, parseQuery, isParseError } from '../../../../../lib/server/menus/parse.ts';
import { unwrapResult, apiError } from '../../../../../lib/server/menus/http-errors.ts';
import { localeFilterQuery } from '../../../../../lib/server/menus/schema-common.ts';
import { z } from 'zod';

export const prerender = false;

const createTranslationBody = z.object({ locale: z.string().min(1), label: z.string().min(1).optional() }).meta({ id: 'CreateMenuTranslationBody' });
export const GET: RequestHandler = event => withMenuRequest(event, false, 'MENU_TRANSLATIONS_ERROR', 'Failed to fetch menu translations', async db => {
  const query = parseQuery(event.url, localeFilterQuery); if (isParseError(query)) return query;
  const anchor = await handleMenuGet(db, event.params.name!, { locale: query.locale });
  return anchor.success ? unwrapResult(await handleMenuTranslations(db, anchor.data.id)) : unwrapResult(anchor);
});
export const POST: RequestHandler = event => withMenuRequest(event, true, 'MENU_TRANSLATION_CREATE_ERROR', 'Failed to create menu translation', async db => {
  const query = parseQuery(event.url, localeFilterQuery); if (isParseError(query)) return query;
  const body = await parseBody(event.request, createTranslationBody); if (isParseError(body)) return body;
  const source = await handleMenuGet(db, event.params.name!, { locale: query.locale }); if (!source.success) return unwrapResult(source);
  return unwrapResult(await handleMenuCreate(db, { name: event.params.name!, label: body.label ?? source.data.label, locale: body.locale, translationOf: source.data.id }), 201);
});
