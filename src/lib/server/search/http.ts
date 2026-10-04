// Native request hosting for the pinned EmDash search routes.
// EmDash 1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; MIT; notices/emdash-MIT.txt.
import type { Kysely } from 'kysely';
import { FTSManager } from '../content-picker/fts-manager.ts';
import type { Database } from '../database/lifecycle/upstream/database/types.ts';
import { InvalidCursorError } from '../database/lifecycle/upstream/database/repositories/types.ts';
import { requireSessionMutationOrigin, SessionOriginError } from '../auth/request.ts';
import { apiError } from '../menus/http-errors.ts';
import { after } from '../menus/after.ts';
import { isSqlite } from '../database/lifecycle/upstream/database/dialect-helpers.ts';
import { createSingleFlightCache, singleFlightCached, type SingleFlightCache } from '../redirects/single-flight-cache.ts';
import type { ServerPrincipal } from '../database/service.ts';

export { apiError };
const health = new WeakMap<object, SingleFlightCache<void>>();
/** Pinned EmDashRuntime.ensureSearchHealthy; cache ownership is per Native DB binding. */
export async function ensureSearchHealthy(db: Kysely<Database>, keepAlive?: (task: Promise<void>) => void): Promise<void> {
  if (!isSqlite(db)) return;
  let cache = health.get(db);
  if (!cache) { cache = createSingleFlightCache<void>(); health.set(db, cache); }
  try {
    await singleFlightCached(cache, async () => {
      try {
        const repaired = await new FTSManager(db).verifyAndRepairAll();
        if (repaired > 0) console.log(`Repaired ${repaired} corrupted FTS index(es)`);
      } catch {
        // Pinned pre-setup/verification errors are non-fatal; cache checked state.
      }
    }, { anchor: promise => { after(() => promise); keepAlive?.(promise); }, ownerTimeoutMs: 30_000 });
  } catch {
    // Pinned owner timeout/waiter failure must not fail the calling search request.
  }
}
/** Already configured trusted storage only. Does not open, migrate or resolve identities. */
export function searchContext(locals: App.Locals) {
  const configured = locals.cms;
  if (!configured) return undefined;
  const db = configured.database.db as unknown as Kysely<Database>;
  return { db, ensureSearchHealthy: () => ensureSearchHealthy(db, configured.keepAlive) };
}
export function hasSearchPermission(principal: ServerPrincipal | null, permission: 'search:manage' | 'content:read_drafts') {
  return principal?.permissions.includes(permission) === true;
}
export function requireSearchManagement(principal: ServerPrincipal | null): Response | undefined {
  if (!principal) return apiError('UNAUTHORIZED', 'Authentication required', 401);
  if (!hasSearchPermission(principal, 'search:manage')) return apiError('FORBIDDEN', 'Insufficient permissions', 403);
}
/** Reuse the published Native opt-in and unchanged session mutation-origin guard. */
export function requireSearchMutation(request: Request, locals: App.Locals): Response | undefined {
  if (locals.cms?.mutationsEnabled !== true) return apiError('MUTATIONS_DISABLED', 'Mutations are disabled', 503);
  try { requireSessionMutationOrigin(request, locals.cmsRuntime?.publicOrigin ?? ''); }
  catch (error) {
    if (error instanceof SessionOriginError) return apiError(error.code, error.message, 403);
    throw error;
  }
}
export function apiSuccess<T>(data: T): Response {
  return Response.json({ success: true, data }, { headers: { 'Cache-Control': 'private, no-store' } });
}
export function handleSearchError(error: unknown, message: string, code: string): Response {
  if (error instanceof InvalidCursorError) return apiError('INVALID_CURSOR', error.message, 400);
  console.error(`[${code}]`, error);
  return apiError(code, message, 500);
}
