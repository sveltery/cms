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
        const input: Record<string,string> = indexing ? { indexedMode: 'set', indexed: 'true' }
          : binding ? { validationMode: 'set', validationJson: JSON.stringify(incompatible.validation) } : { type: 'text' };
        const result = await h.remote('updateSchemaFieldMetadata', 'admin', { collection: 'posts', field: 'candidate', ...input });
        assert.equal(result.type, 'error', 'the effective stored combination is revalidated inside the atomic write');
        assert.equal(result.status, 409); assert.equal(result.error.code, 'FIELD_NOT_INDEXABLE');
        assert.equal(result.data, undefined); assert.equal(result.q, undefined);
        assert.deepEqual(await h.snapshot(), concurrent, 'rejected stale combination changes no metadata, physical indexes or guards');
      } finally { await h.close(); }
    });
  }
  test(`${target}: compatible independent type and metadata edits compose without field CAS`, async () => {
    const h = await schemaAdminRemotes(target);
    try {
      await h.registry.createCollection({ slug: 'posts', label: 'Posts' });
      await h.registry.createField('posts', { slug: 'candidate', label: 'Candidate', type: 'string' });
      const c = (await h.registry.getCollection('posts'))!;
      const original = h.database.atomicBatch.bind(h.database);
      h.database.atomicBatch = async statements => {
        h.database.atomicBatch = original;
        await h.registry.updateField('posts', 'candidate', { type: 'slug', label: 'Concurrent label' });
        return original(statements);
      };
      await h.mutate('updateSchemaFieldMetadata', { collection: 'posts', field: 'candidate', indexedMode: 'set', indexed: 'true',
        optionsMode: 'set', optionsJson: '{"custom":true}' });
      const field = (await h.registry.getField('posts', 'candidate'))!;
      assert.equal(field.type, 'slug'); assert.equal(field.label, 'Concurrent label'); assert.equal(field.indexed, true);
      assert.deepEqual(field.options, { custom: true });
      const after = (await h.registry.getCollection('posts'))!;
      assert.equal(after.version, c.version); assert.equal(after.updatedAt, c.updatedAt);
      assert.deepEqual((await h.snapshot()).guards, []);
      await h.registry.createField('posts', { slug: 'unbound', label: 'Unbound', type: 'reference' });
      for (const validation of [null, {}, { multiple: false }, { targetCollection: 'posts' }]) {
        await h.mutate('updateSchemaFieldMetadata', { collection: 'posts', field: 'unbound', indexedMode: 'set', indexed: 'true',
          validationMode: 'set', validationJson: JSON.stringify(validation),
          defaultValueMode: 'set', defaultValueJson: '{"custom":true}', optionsMode: 'set', optionsJson: '{"custom":true}' });
        const unbound = (await h.registry.getField('posts', 'unbound'))!;
        assert.deepEqual(unbound.validation, validation, 'supported unbound validation preserves null/empty/partial values');
        assert.deepEqual(unbound.defaultValue, { custom: true }); assert.deepEqual(unbound.options, { custom: true });
      }
    } finally { await h.close(); }
  });
}
