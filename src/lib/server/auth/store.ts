import type { Kysely } from 'kysely';
import type { AuthTables } from './schema.ts';
import type { SessionStore } from './session.ts';

/** A fresh joined read makes stored session IDs independent of mutable user privileges. */
export function createKyselySessionStore(db: Kysely<AuthTables>): SessionStore {
  return {
    async read(hash) {
      const row = await db.selectFrom('_cms_auth_sessions as s')
        .innerJoin('_cms_auth_users as u', 'u.id', 's.user_id')
        .select(['u.id', 'u.role', 'u.disabled', 's.expires_at'])
        .where('s.hash', '=', hash).executeTakeFirst();
      if (!row) return null;
      return { user: { id: row.id, role: row.role, disabled: row.disabled !== 0 }, expiresAt: row.expires_at };
    },
    async revoke(hash) { await db.deleteFrom('_cms_auth_sessions').where('hash', '=', hash).execute(); }
  };
}
