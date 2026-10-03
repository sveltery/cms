import { updateContentSlug } from '../../../src/lib/server/redirects/slug-change.ts';
import type { Database } from '../../../src/lib/server/database/lifecycle/upstream/database/types.ts';
import type { Kysely } from 'kysely';
import { encodeRev } from '../../../src/lib/server/database/lifecycle/upstream/api/rev.ts';

// Source-shaped API transport invokes the actual owned transaction engine.
// The prior committed baseline called the preexisting native repository.
export async function handleContentUpdate(db: Kysely<Database>, collection: string, id: string, body: {slug: string}) {
  const item = await updateContentSlug(db, collection, id, body.slug);
  return { success: true as const, data: { item, _rev: encodeRev(item) } };
}
