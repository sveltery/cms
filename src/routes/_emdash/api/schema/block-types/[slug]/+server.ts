import {blockEndpoint} from '$lib/server/blocks/request';
import type {RequestHandler} from './$types';
export const GET:RequestHandler=event=>blockEndpoint(event,'get');
export const PUT:RequestHandler=event=>blockEndpoint(event,'update');
