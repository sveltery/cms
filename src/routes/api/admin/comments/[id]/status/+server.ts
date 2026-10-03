import type { RequestHandler } from './$types';
import { adminCommentsRequest } from '$lib/server/comments/request.ts';
export const PUT: RequestHandler = event => adminCommentsRequest(event, 'status');
