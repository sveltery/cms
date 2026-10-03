import {blockEndpoint} from '$lib/server/blocks/request';
import type {RequestHandler} from './$types';
export const POST:RequestHandler=event=>blockEndpoint(event,'activate');
