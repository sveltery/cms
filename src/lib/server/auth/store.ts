import type { Kysely } from 'kysely';
import type { AuthTables } from './schema.ts';
import type { SessionStore } from './session.ts';
export function createKyselySessionStore(db: Kysely<AuthTables>): SessionStore {
  return { async read(hash) { return null; }, async revoke(hash) {} };
}
