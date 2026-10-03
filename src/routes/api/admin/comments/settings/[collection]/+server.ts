import type { RequestHandler } from './$types';
import { commentSettingsRequest } from '$lib/server/comments/settings.ts';
export const GET:RequestHandler=commentSettingsRequest;
export const PUT:RequestHandler=commentSettingsRequest;
