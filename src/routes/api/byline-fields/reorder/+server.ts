// Native SvelteKit transport for pinned EmDash byline administrative handlers.
import type {RequestHandler} from "@sveltejs/kit";
import {withBylineRequest} from "../../../../lib/server/bylines/http.ts";
import * as routes from "../../../../lib/server/bylines/routes-field-reorder.ts";
export const prerender=false;
export const POST:RequestHandler=event=>withBylineRequest(event,"schema:manage",routes.POST);
