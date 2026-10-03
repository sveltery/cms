import {blockEndpoint} from '$lib/server/blocks/request';
import type {RequestHandler} from './$types';
export const GET:RequestHandler=event=>blockEndpoint(event,'list');
export const POST:RequestHandler=event=>blockEndpoint(event,'create');
