import type { RequestHandler } from './$types';
import { adminCommentsRequest } from '$lib/server/comments/request.ts';
export const GET: RequestHandler = event => adminCommentsRequest(event, 'inbox');
