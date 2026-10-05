import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sql } from 'kysely';
import { historicalFeatureStorage, type StorageMode } from './helpers/canonical-feature-storage-original.ts';
import { migrateCms } from '../src/lib/server/database/migrations.ts';
import { RelationRepository } from '../src/lib/server/relations/repository.ts';

// Original native requirement for existing C-07: all statements commit or none do.
// Ordinary persisted SQL fault; no credentials, caller changes or race probe.
for (const mode of ['Node', 'raw D1', 'scoped D1'] as const satisfies readonly StorageMode[]) {
  test(`${mode} relation replacement rolls back every chunk on a real SQL failure`, async () => {
    const host = await historicalFeatureStorage(mode, 0);
    try {
      await migrateCms(host.database);
      const repo = new RelationRepository(host.database);
      const relation = await repo.create({ slug: 'batch_failure', parentCollection: 'post', childCollection: 'page', parentLabel: 'Post', childLabel: 'Page' });
      await repo.setChildren(relation.id, 'parent', ['existing']);
      await sql`CREATE TRIGGER relation_fixture_abort BEFORE INSERT ON _cms_content_references
        WHEN NEW.child_group = 'child-17' BEGIN SELECT RAISE(ABORT, 'actual relation fixture failure'); END`.execute(host.database.db);
      const children = Array.from({ length: 40 }, (_, index) => `child-${index}`);
      await assert.rejects(repo.setChildren(relation.id, 'parent', children), /actual relation fixture failure/);
      assert.deepEqual((await repo.getChildren(relation.id, 'parent')).map(edge => edge.childGroup), ['existing']);
      assert.equal(await repo.countChildren(relation.id, 'parent'), 1);
    } finally { await host.close(); }
  });
}
