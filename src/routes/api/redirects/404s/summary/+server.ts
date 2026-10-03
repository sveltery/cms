import type {RequestHandler} from './$types';
import {redirectEndpoint} from '$lib/server/redirects/request';
export const GET:RequestHandler=event=>redirectEndpoint(event,'summary404');
