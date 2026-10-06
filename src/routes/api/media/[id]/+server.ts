// Native Kit transport for complete pinned media route bodies.
import type {RequestHandler} from "@sveltejs/kit";
import {withMediaRequest} from "../../../../lib/server/general-media/http.ts";
import * as routes from "../../../../lib/server/general-media/upstream/astro/routes/api/media/[id].ts";
export const prerender=false;
export const GET:RequestHandler=event=>withMediaRequest(event,"media:read",routes.GET);
export const PUT:RequestHandler=event=>withMediaRequest(event,"media:edit_own",routes.PUT);
export const DELETE:RequestHandler=event=>withMediaRequest(event,"media:delete_own",routes.DELETE);
