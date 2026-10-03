import type { RequestHandler } from './$types';
import { publicCommentsRequest } from '$lib/server/comments/request.ts';
export const GET: RequestHandler = publicCommentsRequest;
export const POST: RequestHandler = publicCommentsRequest;
