import { ContentRepository } from '../../../src/lib/server/database/lifecycle/upstream/database/repositories/content.ts';
import type { Database } from '../../../src/lib/server/database/lifecycle/upstream/database/types.ts';
import type { Kysely } from 'kysely';
import { encodeRev } from '../../../src/lib/server/database/lifecycle/upstream/api/rev.ts';

// First-execution baseline calls the existing real native repository signature.
// Redirect assertions are left to fail naturally; no synthetic redirect rows.
export async function handleContentUpdate(db: Kysely<Database>, collection: string, id: string, body: {slug: string}) {
  const item = await new ContentRepository(db).update(collection, id, body);
  return { success: true as const, data: { item, _rev: encodeRev(item) } };
}
