// Native SvelteKit transport for pinned EmDash byline administrative handlers.
import type {RequestHandler} from "@sveltejs/kit";
import {withBylineRequest} from "../../../../../lib/server/bylines/http.ts";
import * as routes from "../../../../../lib/server/bylines/routes-translations.ts";
export const prerender=false;
export const GET:RequestHandler=event=>withBylineRequest(event,"bylines:read",routes.GET);
export const POST:RequestHandler=event=>withBylineRequest(event,"bylines:manage",routes.POST);
