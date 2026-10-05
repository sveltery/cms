import * as routes from '../../../src/lib/server/general-media/upstream/astro/routes/api/media/folders/[id].ts';
import { referenceRoute } from './reference-context.ts';
export const GET=referenceRoute(routes.GET);
export const PUT=referenceRoute(routes.PUT);
export const DELETE=referenceRoute(routes.DELETE);
