import type {RequestHandler} from './$types';
import {GET as source} from '$lib/server/search/api/index.ts';
import {nativeSearchRoute} from '$lib/server/search/api/native.ts';
export const GET:RequestHandler=event=>nativeSearchRoute(event,source,false);
