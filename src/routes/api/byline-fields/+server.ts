// Native SvelteKit transport for pinned EmDash byline administrative handlers.
import type {RequestHandler} from "@sveltejs/kit";
import {withBylineRequest} from "../../../lib/server/bylines/http.ts";
import * as routes from "../../../lib/server/bylines/routes-fields.ts";
export const prerender=false;
export const GET:RequestHandler=event=>withBylineRequest(event,"schema:read",routes.GET);
export const POST:RequestHandler=event=>withBylineRequest(event,"schema:manage",routes.POST);
