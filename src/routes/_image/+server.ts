import type {RequestHandler} from './$types';
import {mediaImageHttp} from '$lib/server/media/image/http';
export const GET:RequestHandler=event=>mediaImageHttp(event);
