import type {RequestHandler} from './$types';
import {mediaHttp} from '$lib/server/media/http';
export const GET:RequestHandler=event=>mediaHttp(event);
export const POST:RequestHandler=event=>mediaHttp(event);
