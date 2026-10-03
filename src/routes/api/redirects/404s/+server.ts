import type {RequestHandler} from './$types';
import {redirectEndpoint} from '$lib/server/redirects/request';
export const GET:RequestHandler=event=>redirectEndpoint(event,'list404');
export const POST:RequestHandler=event=>redirectEndpoint(event,'prune404');
export const DELETE:RequestHandler=event=>redirectEndpoint(event,'clear404');
