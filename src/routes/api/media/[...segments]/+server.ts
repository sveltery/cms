import type {RequestHandler} from './$types';
import {mediaHttp} from '$lib/server/media/http';
const handle:RequestHandler=event=>mediaHttp(event,event.params.segments);
export const GET=handle,POST=handle,PUT=handle,DELETE=handle;
