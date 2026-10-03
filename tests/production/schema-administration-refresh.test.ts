import test from 'node:test';
import assert from 'node:assert/strict';
import { schemaAdminRemotes } from '../helpers/schema-admin-remotes.ts';

// Original registered-query cache checks; no whole-browser or source credit.
for (const target of ['Node', 'D1'] as const) {
  test(`${target}: partial collection ordering refreshes both detail families for every affected slug`, async () => {
    const h = await schemaAdminRemotes(target);
    try {
      for (const slug of ['first', 'second']) await h.mutate('createSchemaCollection', { slug, label: slug });
      const before = await h.query('listSchemaCollections');
      for (const collection of before) {
        await h.query('getSchemaCollection', collection.slug);
        await h.query('getCollection', collection.slug);
      }
      const expected = before.map(({ slug, version, updatedAt }: any) => ({ slug, version, updatedAt }));
      const result = await h.mutate('reorderSchemaCollections', { slugs: '["first"]', expected: JSON.stringify(expected) });
      assert.deepEqual(result._.result, { reordered: true }, 'the public mutation receipt remains bounded');
      for (const name of ['getSchemaCollection', 'getCollection']) {
        const details = Object.entries(result.q ?? {}).filter(([key]) => key.includes(`/${name}/`)).map(([, value]: any) => value.v);
        assert.deepEqual(details.map((value: any) => value.slug).sort(), ['first', 'second'], `${name} refreshes omitted partial-order entries too`);
        assert.ok(details.every((value: any) => value.updatedAt > before.find((old: any) => old.slug === value.slug).updatedAt));
        assert.equal(details.find((value: any) => value.slug === 'second').sortOrder, undefined);
      }
    } finally { await h.close(); }
  });
  test(`${target}: collection ordering denied before storage returns no refreshed private details`, async () => {
    const h = await schemaAdminRemotes(target);
    try {
      await h.mutate('createSchemaCollection', { slug: 'private_posts', label: 'Private schema label' });
      const c = await h.query('getSchemaCollection', 'private_posts');
      const before = await h.snapshot();
      h.probeStorage();
      for (const name of ['getSchemaCollection', 'getCollection']) {
        const denied = await h.remote(name, 'author', undefined, 'private_posts');
        assert.equal(denied.status, 403);
        assert.equal(denied.error.code, 'INSUFFICIENT_PERMISSIONS');
        assert.equal(denied.data, undefined);
      }
      const result = await h.remote('reorderSchemaCollections', 'author', { slugs: '["private_posts"]', expected: JSON.stringify([{ slug: c.slug, version: c.version, updatedAt: c.updatedAt }]) });
      assert.equal(result.type, 'error'); assert.equal(result.status, 403);
      assert.equal(result.error.code, 'INSUFFICIENT_PERMISSIONS');
      assert.equal(result.data, undefined); assert.equal(result.q, undefined);
      assert.doesNotMatch(JSON.stringify(result), /Private schema label/);
      assert.equal(h.storageReads, 0);
      assert.deepEqual(await h.snapshot(), before);
    } finally { await h.close(); }
  });
}
