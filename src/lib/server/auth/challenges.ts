// Adapted from EmDash 1.1.0, MIT, Copyright 2026 Cloudflare Inc.
// 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e:packages/core/src/auth/challenge-store.ts.
import type { CmsDatabase } from '../database/contract.ts';
import type { ChallengeData, ChallengeStore } from './vendor/passkey/types.ts';
import { identityDb } from './identity-store.ts';

/** Preserve the pinned get/delete store contract; no atomic-consumption claim is made. */
export function createChallengeStore(database: CmsDatabase): ChallengeStore {
  const db = identityDb(database);
  return {
    async set(challenge, data) {
      const values = { challenge, type: data.type, user_id: data.userId ?? null, data: data.context ?? null,
        expires_at: new Date(data.expiresAt).toISOString(), created_at: new Date().toISOString() };
      await db.insertInto('_cms_auth_challenges').values(values).onConflict(oc => oc.column('challenge').doUpdateSet({
        type: values.type, user_id: values.user_id, data: values.data, expires_at: values.expires_at
      })).execute();
    },
    async get(challenge) {
      const row = await db.selectFrom('_cms_auth_challenges').selectAll().where('challenge', '=', challenge).executeTakeFirst();
      if (!row) return null;
      const expiresAt = new Date(row.expires_at).getTime();
      if (expiresAt < Date.now()) { await this.delete(challenge); return null; }
      return { type: row.type === 'registration' ? 'registration' : 'authentication', userId: row.user_id ?? undefined,
        expiresAt, ...(row.data === null ? {} : { context: row.data }) } satisfies ChallengeData;
    },
    async delete(challenge) { await db.deleteFrom('_cms_auth_challenges').where('challenge', '=', challenge).execute(); }
  };
}
export async function cleanupExpiredChallenges(database: CmsDatabase): Promise<number> {
  const result = await identityDb(database).deleteFrom('_cms_auth_challenges').where('expires_at', '<', new Date().toISOString()).executeTakeFirst();
  return Number(result.numDeletedRows ?? 0);
}
