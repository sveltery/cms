import test from 'node:test';
import assert from 'node:assert/strict';
import { schemaAdminRemotes } from '../helpers/schema-admin-remotes.ts';

// Native identity/atomic index-write regressions; no source D1 race credit.
for (const target of ['Node', 'D1'] as const) {
  for (const replacement of [false, true]) {
    test(`${target}: enabling an index after field ${replacement ? 'replacement' : 'deletion'} preserves the independently committed schema`, async () => {
      const h = await schemaAdminRemotes(target);
      try {
        await h.registry.createCollection({ slug: 'posts', label: 'Posts' });
        await h.registry.createField('posts', { slug: 'candidate', label: 'Candidate', type: 'string' });
        const c = (await h.registry.getCollection('posts'))!;
        const original = h.database.atomicBatch.bind(h.database);
        let concurrent: Awaited<ReturnType<typeof h.snapshot>> | undefined;
        h.database.atomicBatch = async statements => {
          h.database.atomicBatch = original;
          await h.registry.deleteField('posts', 'candidate', { version: c.version, updatedAt: c.updatedAt });
          if (replacement) await h.registry.createField('posts', { slug: 'candidate', label: 'Replacement', type: 'string' });
          concurrent = await h.snapshot();
          return original(statements);
        };
        const result = await h.remote('updateSchemaFieldMetadata', 'admin', { collection: 'posts', field: 'candidate', indexedMode: 'set', indexed: 'true' });
        assert.equal(result.type, 'error'); assert.equal(result.status, 404); assert.equal(result.error.code, 'NOT_FOUND');
        assert.equal(result.data, undefined); assert.equal(result.q, undefined);
        assert.deepEqual(await h.snapshot(), concurrent, 'missing original identity cannot create an index on the deleted or replacement column');
        if (replacement) assert.equal((await h.registry.getField('posts', 'candidate'))!.indexed, false);
      } finally { await h.close(); }
    });
  }
  test(`${target}: non-index metadata keeps initial and concurrent missing-field errors`, async () => {
    const h = await schemaAdminRemotes(target);
    try {
      await h.registry.createCollection({ slug: 'posts', label: 'Posts' });
      await h.registry.createField('posts', { slug: 'candidate', label: 'Candidate', type: 'string', indexed: true });
      const c = (await h.registry.getCollection('posts'))!;
      const original = h.database.atomicBatch.bind(h.database);
      let concurrent: Awaited<ReturnType<typeof h.snapshot>> | undefined;
      h.database.atomicBatch = async statements => {
        h.database.atomicBatch = original;
        await h.registry.deleteField('posts', 'candidate', { version: c.version, updatedAt: c.updatedAt });
        concurrent = await h.snapshot(); return original(statements);
      };
      const input = { collection: 'posts', field: 'candidate', widgetMode: 'set', widget: 'plain' };
      const result = await h.remote('updateSchemaFieldMetadata', 'admin', input);
      assert.equal(result.type, 'error'); assert.equal(result.status, 404); assert.equal(result.error.code, 'NOT_FOUND');
      assert.deepEqual(await h.snapshot(), concurrent);
      const missing = await h.remote('updateSchemaFieldMetadata', 'admin', input);
      assert.equal(missing.type, 'error'); assert.equal(missing.error.code, 'NOT_FOUND');
      assert.deepEqual(await h.snapshot(), concurrent);
    } finally { await h.close(); }
  });
}
