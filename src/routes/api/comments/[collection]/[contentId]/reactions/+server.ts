import type { RequestHandler } from './$types';
import { reactionCommentsRequest } from '$lib/server/comments/request.ts';
export const GET: RequestHandler = reactionCommentsRequest;
export const POST: RequestHandler = reactionCommentsRequest;
