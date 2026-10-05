import type {RequestHandler} from '@sveltejs/kit';
import {withMediaRequest} from '../../../../../lib/server/general-media/http.ts';
import * as route from '../../../../../lib/server/media-admin/api/media/_id_/usage.ts';
export const prerender=false;
export const GET:RequestHandler=event=>withMediaRequest(event,'media:read',route.GET);
