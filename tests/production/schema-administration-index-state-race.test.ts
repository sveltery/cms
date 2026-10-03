import test from 'node:test';
import assert from 'node:assert/strict';
import { schemaAdminRemotes } from '../helpers/schema-admin-remotes.ts';

// Native effective-state validation; no copied declaration or source D1 race credit.
for (const target of ['Node', 'D1'] as const) {
  for (const binding of [false, true]) for (const indexing of [false, true]) {
    test(`${target}: concurrent ${binding ? 'reference binding' : 'text alias'} ${indexing ? 'before indexing' : 'after indexing'} cannot persist an invalid indexed field`, async () => {
      const h = await schemaAdminRemotes(target);
      try {
        await h.registry.createCollection({ slug: 'posts', label: 'Posts' });
        await h.registry.createField('posts', { slug: 'candidate', label: 'Candidate', type: binding ? 'reference' : 'string' });
        const incompatible = binding
          ? { validation: { relation: 'post_links', relationSide: 'child', targetCollection: 'posts' } }
          : { type: 'text' };
        const original = h.database.atomicBatch.bind(h.database);
        let concurrent: Awaited<ReturnType<typeof h.snapshot>> | undefined;
        h.database.atomicBatch = async statements => {
          h.database.atomicBatch = original;
          await h.registry.updateField('posts', 'candidate', indexing ? incompatible : { indexed: true });
          concurrent = await h.snapshot(); return original(statements);
        };
        const input = indexing ? { indexedMode: 'set', indexed: 'true' }
          : binding ? { validationMode: 'set', validationJson: JSON.stringify(incompatible.validation) } : { type: 'text' };
        const result = await h.remote('updateSchemaFieldMetadata', 'admin', { collection: 'posts', field: 'candidate', ...input });
        assert.equal(result.type, 'error', 'the effective stored combination is revalidated inside the atomic write');
        assert.equal(result.status, 409); assert.equal(result.error.code, 'FIELD_NOT_INDEXABLE');
        assert.equal(result.data, undefined); assert.equal(result.q, undefined);
        assert.deepEqual(await h.snapshot(), concurrent, 'rejected stale combination changes no metadata, physical indexes or guards');
      } finally { await h.close(); }
    });
  }
}
