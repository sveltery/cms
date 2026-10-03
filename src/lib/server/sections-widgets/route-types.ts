import type { Kysely } from 'kysely';
import type { ServerPrincipal } from '../database/service.ts';
import type { Database } from './database-types.ts';
/** Typed native host for the preserved Source route callbacks. No caller identity input. */
export interface SourceRouteContext {
  url: URL; request: Request; params: Record<string, string | undefined>;
  locals: { emdash: { db: Kysely<Database> }; user: ServerPrincipal | null };
  cache?: { enabled: boolean; invalidate(input: { tags: string[] }): Promise<void> };
}
export type APIRoute = (context: SourceRouteContext) => Promise<Response>;
