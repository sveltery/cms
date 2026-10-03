import type { RequestEvent } from '@sveltejs/kit';
import { commentsReady } from './readiness.ts';

export function commentsUnavailable(): Response {
  return Response.json({ success: false, error: { code: 'COMMENTS_UNAVAILABLE', message: 'Comments storage is unavailable' } },
    { status: 503, headers: { 'cache-control': 'private, no-store' } });
}

export async function unavailableCommentsRequest(event: RequestEvent): Promise<Response> {
  const database = event.locals.cms?.database;
  if (!database || !await commentsReady(database)) return commentsUnavailable();
  // Native operation composition follows in the next test-first storage slice.
  return commentsUnavailable();
}
