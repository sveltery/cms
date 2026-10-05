import * as routes from "../../../src/lib/server/bylines/routes-profile.ts";
import {referenceRoute} from "./reference-context.ts";
export const GET=referenceRoute(routes.GET);
export const PUT=referenceRoute(routes.PUT);
export const DELETE=referenceRoute(routes.DELETE);
