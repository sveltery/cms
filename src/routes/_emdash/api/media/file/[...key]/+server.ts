// Native Kit transport for complete pinned media route bodies.
import type {RequestHandler} from "@sveltejs/kit";
import {withMediaRequest} from "../../../../../../lib/server/general-media/http.ts";
import * as routes from "../../../../../../lib/server/general-media/upstream/astro/routes/api/media/file/[...key].ts";
export const prerender=false;
export const GET:RequestHandler=event=>withMediaRequest(event,null,routes.GET);
