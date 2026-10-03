import test from 'node:test';
import assert from 'node:assert/strict';
import { schemaAdminRemotes } from '../helpers/schema-admin-remotes.ts';

// Native guarded-write regressions; no copied source declaration/race credit.
for (const target of ['Node', 'D1'] as const) {
  for (const stored of [true, false]) {
    test(`${target}: guarded deletion rejects a concurrently deleted ${stored ? 'stored' : 'storageless'} field`, async () => {
      const h = await schemaAdminRemotes(target);
      try {
        await h.registry.createCollection({ slug: 'posts', label: 'Posts' });
        await h.registry.createField('posts', { slug: 'candidate', label: 'Candidate',
          type: stored ? 'string' : 'reference',
          ...(stored ? { indexed: true } : { validation: { relation: 'post_links', relationSide: 'child', targetCollection: 'posts' } }) });
        const c = (await h.registry.getCollection('posts'))!;
        const original = h.database.atomicBatch.bind(h.database);
        let raced = false;
        let concurrent: Awaited<ReturnType<typeof h.snapshot>> | undefined;
        h.database.atomicBatch = async statements => {
          h.database.atomicBatch = original; raced = true;
          await h.registry.deleteField('posts', 'candidate', { version: c.version, updatedAt: c.updatedAt });
          const after = (await h.registry.getCollection('posts'))!;
          assert.equal(after.version, c.version);
          assert.equal(after.updatedAt, c.updatedAt, 'deleting an unused field does not consume a collection revision');
          concurrent = await h.snapshot();
          return original(statements);
        };
        const input = { collection: 'posts', field: 'candidate', version: String(c.version), updatedAt: c.updatedAt };
        const result = await h.remote('deleteSchemaField', 'admin', input);
        assert.equal(raced, true, 'the independent deletion commits after all outer preflight reads');
        assert.equal(result.type, 'error');
        assert.equal(result.status, 409, 'a guarded stale deletion is a domain conflict rather than raw DDL error or success');
        assert.equal(result.error.code, 'CONFLICT');
        assert.equal(result.data, undefined); assert.equal(result.q, undefined);
        assert.deepEqual(await h.snapshot(), concurrent, 'failed deletion preserves the committed metadata, DDL, indexes and empty guard state');
        assert.equal(await h.registry.getField('posts', 'candidate'), null);
        const missing = await h.remote('deleteSchemaField', 'admin', input);
        assert.equal(missing.type, 'error'); assert.equal(missing.status, 404); assert.equal(missing.error.code, 'NOT_FOUND');
        assert.deepEqual(await h.snapshot(), concurrent, 'initially missing fields retain NOT_FOUND without writes');
      } finally { await h.close(); }
    });
  }
}
