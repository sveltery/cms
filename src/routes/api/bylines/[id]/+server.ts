// Native SvelteKit transport for pinned EmDash byline administrative handlers.
import type {RequestHandler} from "@sveltejs/kit";
import {withBylineRequest} from "../../../../lib/server/bylines/http.ts";
import * as routes from "../../../../lib/server/bylines/routes-profile.ts";
export const prerender=false;
export const GET:RequestHandler=event=>withBylineRequest(event,"bylines:read",routes.GET);
export const PUT:RequestHandler=event=>withBylineRequest(event,"bylines:manage",routes.PUT);
export const DELETE:RequestHandler=event=>withBylineRequest(event,"bylines:manage",routes.DELETE);
