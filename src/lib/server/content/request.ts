import { error } from '@sveltejs/kit';
import { getRequestEvent } from '$app/server';
import { authorize, contentService, ContentError, type Capability } from './service';

export function requestContent(capability: Capability) {
  const context = getRequestEvent().locals.cms;
  authorize(context?.principal ?? null, capability);
  if (!context) error(503, 'Content storage is not configured');
  return contentService(context.repository, context.principal);
}

export async function contentResponse<T>(run: () => Promise<T>): Promise<T> {
  try { return await run(); }
  catch (cause) {
    if (cause instanceof ContentError) {
      const statuses = { unauthenticated: 401, forbidden: 403, 'not-found': 404 } as const;
      error(statuses[cause.code], cause.message);
    }
    throw cause;
  }
}
