import type {RequestHandler} from './$types';
import {redirectEndpoint} from '$lib/server/redirects/request';
export const GET:RequestHandler=event=>redirectEndpoint(event,'get');
export const PUT:RequestHandler=event=>redirectEndpoint(event,'update');
export const DELETE:RequestHandler=event=>redirectEndpoint(event,'delete');
