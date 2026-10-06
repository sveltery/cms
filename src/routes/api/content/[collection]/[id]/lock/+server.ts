import type {RequestHandler} from '@sveltejs/kit';
import {entryLockHttp} from '$lib/server/entry-locks/http.ts';
export const prerender=false;
export const GET:RequestHandler=event=>entryLockHttp(event,'GET');
export const POST:RequestHandler=event=>entryLockHttp(event,'POST');
export const DELETE:RequestHandler=event=>entryLockHttp(event,'DELETE');
