import * as routes from "../../../src/lib/server/bylines/routes-field.ts";
import {referenceRoute} from "./reference-context.ts";
export const GET=referenceRoute(routes.GET);
export const PATCH=referenceRoute(routes.PATCH);
export const DELETE=referenceRoute(routes.DELETE);
