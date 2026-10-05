// Original controlled Source Role fixture -> the actual Native API route owner.
import type {APIRoute} from '../../src/lib/server/general-media/upstream/api/context.ts';
import {referenceRoute} from './general-media/reference-context.ts';
const modules=import.meta.glob('../../src/lib/server/media-admin/api/media/_id_/usage.ts',{eager:true});
const actual=modules['../../src/lib/server/media-admin/api/media/_id_/usage.ts'] as {GET?:APIRoute}|undefined;
export const GET=actual?.GET?referenceRoute(actual.GET):undefined;
