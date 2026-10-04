// EmDash 1.1.0 MIT, Copyright 2026 Cloudflare Inc.
// Pin913cb1bb9b7f08c3ff0d258b4420e53835b6a58e:core/astro/routes/api/auth/me.ts
// The pinned dismissal merges user.data and persists it through the user repository.
import type { CmsDatabase } from '../database/contract.ts';
import type { User } from '../auth/vendor/types.ts';
import { identityDb } from '../auth/identity-store.ts';

/** Native split-profile storage; callers supply only the actual resolved stored user. */
export async function persistWelcomeDismissed(database: CmsDatabase, user: User) {
  const data = JSON.stringify({ ...user.data, welcomeDismissed: true });
  await identityDb(database).updateTable('_cms_auth_profiles')
    .set({ data })
    .where('user_id', '=', user.id).execute();
}
