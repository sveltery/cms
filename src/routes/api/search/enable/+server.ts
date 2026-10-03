import type {RequestHandler} from './$types';
import {POST as source} from '$lib/server/search/api/enable.ts';
import {nativeSearchRoute} from '$lib/server/search/api/native.ts';
export const POST:RequestHandler=event=>nativeSearchRoute(event,source,true);
