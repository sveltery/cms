import type { RequestHandler } from './$types';
import { adminCommentsRequest } from '$lib/server/comments/request.ts';
export const POST: RequestHandler = event => adminCommentsRequest(event, 'bulk');
