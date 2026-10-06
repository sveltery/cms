// Native Kit transport for the complete pinned media upload route.
import type {RequestHandler} from "@sveltejs/kit";
import {withMediaRequest} from "../../../../../lib/server/general-media/http.ts";
import * as routes from "../../../../../lib/server/general-media/upstream/astro/routes/api/media/[id]/confirm.ts";
export const prerender=false;
export const POST:RequestHandler=event=>withMediaRequest(event,"media:upload",routes.POST);
