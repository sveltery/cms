import { afterEach, describe, expect, it } from 'vitest';
import { openSqlite } from '../../src/lib/server/database/sqlite.ts';
import { migrateCms } from '../../src/lib/server/database/migrations.ts';
import { SchemaRegistry } from '../../src/lib/server/database/registry.ts';
import { ContentRepository } from '../../src/lib/server/database/lifecycle/upstream/database/repositories/content.ts';
import { RevisionRepository } from '../../src/lib/server/database/lifecycle/upstream/database/repositories/revision.ts';
import { createContentAccess } from '../../src/lib/server/plugins/content-access.ts';
import { pluginSourceDatabase } from '../../src/lib/server/plugins/database.ts';
import { withTransaction } from '../../src/lib/server/plugins/transaction.ts';
import type { CmsDatabase } from '../../src/lib/server/database/contract.ts';
const opened: CmsDatabase[] = [];
afterEach(async () => { for (const database of opened.splice(0)) await database.close(); });
async function fixture() {
  const database = openSqlite(':memory:'); opened.push(database); await migrateCms(database);
  const registry = new SchemaRegistry(database);
  await registry.createCollection({ slug: 'posts', label: 'Posts', supports: ['revisions'] });
  await registry.createField('posts', { slug: 'title', label: 'Title', type: 'string' });
  return { database, db: pluginSourceDatabase(database) };
}
describe('plugin content access delegates to the sole canonical lifecycle owner', () => {
  it('reads canonical stored content and its actual revision through the registered ordinary view', async () => {
    const { database, db } = await fixture();
    const created = await new ContentRepository(database.db).create({ type: 'posts', data: { title: 'Stored title' } });
    const revision = await new RevisionRepository(database.db).create({ collection: 'posts', entryId: created.id, data: created.data });
    const access = createContentAccess(db, { revisions: true });
    expect((await access.get('posts', created.id))?.data).toEqual({ title: 'Stored title' });
    expect((await access.getRevision!('posts', created.id, revision.id))?.data).toEqual({ title: 'Stored title' });
  });
  it('refuses an unknown derived namespace before exposing canonical content access', async () => {
    const { db } = await fixture();
    const derived = db.withPlugin({ transformQuery: args => args.node, transformResult: async args => args.result });
    expect(() => createContentAccess(derived)).toThrow('registered CMS database owner');
  });
  it('reads the genuine current transaction and leaves its uncommitted content absent after rollback', async () => {
    const { database, db } = await fixture();
    let id = '';
    await expect(withTransaction(db, async trx => {
      const created = await new ContentRepository(trx).create({ type: 'posts', data: { title: 'Uncommitted' } }); id = created.id;
      expect((await createContentAccess(trx).get('posts', id))?.data).toEqual({ title: 'Uncommitted' });
      throw new Error('controlled rollback');
    })).rejects.toThrow('controlled rollback');
    expect(await new ContentRepository(database.db).findById('posts', id)).toBeNull();
  });
});
