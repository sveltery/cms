import * as routes from '../../../src/lib/server/general-media/upstream/astro/routes/api/media/folders/index.ts';
import { referenceRoute } from './reference-context.ts';
export const GET=referenceRoute(routes.GET);
export const POST=referenceRoute(routes.POST);
