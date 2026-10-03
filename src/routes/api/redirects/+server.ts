import type {RequestHandler} from './$types';
import {redirectEndpoint} from '$lib/server/redirects/request';
export const GET:RequestHandler=event=>redirectEndpoint(event,'list');
export const POST:RequestHandler=event=>redirectEndpoint(event,'create');
