import test from 'node:test';
import assert from 'node:assert/strict';
import { parse } from 'devalue';
import { sql } from 'kysely';
import { schemaAdminRemotes } from '../helpers/schema-admin-remotes.ts';

// Qualified PR49 registered-transport reproductions; original supplements,
// not copied source declarations or whole-browser cache evidence.
for (const target of ['Node', 'D1'] as const) {
  test(`${target}: legacy scalar options preserve numeric metadata and full JSON editing`, async () => {
    const h = await schemaAdminRemotes(target);
    try {
      await h.mutate('createSchemaCollection', { slug: 'posts', label: 'Posts' });
      let c = await h.query('getSchemaCollection', 'posts');
      await h.mutate('addSchemaField', { collection: 'posts', expectedSchemaVersion: String(c.version),
        slug: 'priority', label: 'Priority', type: 'integer', defaultValueJson: '2', validationJson: '{"min":0,"max":10}' });
      const before = await h.snapshot();
      const result = await h.remote('updateSchemaFieldOptions', 'admin', { collection: 'posts', field: 'priority',
        id: 'posts/priority', defaultValueMode: 'set', defaultValue: '2', validationMode: 'set',
        minLength: '', maxLength: '', patternMode: 'omit' });
      c = await h.query('getSchemaCollection', 'posts');
      assert.equal(c.fields[0].defaultValue, 2, 'displayed numeric defaults must not be coerced to strings through a scalar-only form');
      assert.deepEqual(c.fields[0].validation, { min: 0, max: 10 }, 'scalar bounds must not replace numeric validation');
      assert.equal(result.type, 'error'); assert.equal(result.status, 409);
      assert.deepEqual(result.error, { message: 'unsupported-field-type', code: 'UNSUPPORTED_FIELD_TYPE' });
      assert.equal(result.data, undefined); assert.equal(result.q, undefined);
      assert.deepEqual(await h.snapshot(), before);
      const html = await (await h.request('/schema/posts')).text();
      assert.doesNotMatch(html, /<legend[^>]*>Edit priority options<\/legend>/);
      assert.match(html, /<legend[^>]*>Settings for Priority<\/legend>/, 'full JSON editor remains available');
      await h.mutate('updateSchemaFieldMetadata', { collection: 'posts', field: 'priority', id: 'posts/priority',
        defaultValueMode: 'set', defaultValueJson: '3', validationMode: 'set',
        validationJson: '{"min":1,"max":20,"customRule":{"threshold":4}}' });
      const edited = (await h.query('getSchemaCollection', 'posts')).fields[0];
      assert.equal(edited.defaultValue, 3);
      assert.deepEqual(edited.validation, { min: 1, max: 20, customRule: { threshold: 4 } }, 'generic metadata retains unknown source keys');
    } finally { await h.close(); }
  });

  test(`${target}: legacy scalar UI and transport allow only supported string text slug types`, async () => {
    const h = await schemaAdminRemotes(target);
    try {
      await h.registry.createCollection({ slug: 'posts', label: 'Posts' });
      for (const type of ['string', 'text', 'slug'] as const) {
        await h.registry.createField('posts', { slug: type, label: type, type });
        await h.mutate('updateSchemaFieldOptions', { collection: 'posts', field: type, id: `posts/${type}`,
          defaultValueMode: 'set', defaultValue: `value-${type}` });
      }
      await h.registry.createField('posts', { slug: 'future', label: 'Future', type: 'string' });
      await sql`UPDATE _cms_fields SET type='future_field_type' WHERE slug='future'`.execute(h.database.db);
      const before = await h.snapshot();
      const result = await h.remote('updateSchemaFieldOptions', 'admin', { collection: 'posts', field: 'future',
        id: 'posts/future', defaultValueMode: 'set', defaultValue: 'replacement' });
      assert.equal(result.type, 'error'); assert.equal(result.error.code, 'UNSUPPORTED_FIELD_TYPE');
      assert.deepEqual(await h.snapshot(), before);
      const html = await (await h.request('/schema/posts')).text();
      for (const type of ['string', 'text', 'slug']) {
        assert.match(html, new RegExp(`<legend[^>]*>Edit ${type} options</legend>`));
        assert.equal((await h.registry.getField('posts', type))!.defaultValue, `value-${type}`);
      }
      assert.doesNotMatch(html, /<legend[^>]*>Edit future options<\/legend>/, 'fallback string projection is not a supported raw scalar type');
    } finally { await h.close(); }
  });

  test(`${target}: collection deletion refreshes both deleted detail families in its redirect envelope`, async () => {
    const h = await schemaAdminRemotes(target);
    try {
      await h.mutate('createSchemaCollection', { slug: 'posts', label: 'Private deleted label' });
      await h.mutate('createSchemaCollection', { slug: 'other', label: 'Other' });
      const c = await h.query('getSchemaCollection', 'posts');
      await h.query('getCollection', 'posts');
      const result = await h.remote('deleteSchemaCollection', 'admin', { collection: 'posts', id: 'posts',
        version: String(c.version), updatedAt: c.updatedAt });
      assert.equal(result.type, 'result');
      const data = parse(result.data, h.decoders);
      assert.equal(typeof data.redirect, 'string', 'compiled form returns its redirect envelope');
      assert.equal(new URL(data.redirect, `${h.origin}/schema/posts`).pathname, '/schema');
      assert.ok(data.r, 'native Kit retains its successful redirect receipt');
      for (const name of ['getSchemaCollection', 'getCollection']) {
        const details = Object.entries(data.q ?? {}).filter(([key]) => key.includes(`/${name}/`));
        assert.equal(details.length, 1, `redirect refreshes the deleted ${name} cache entry only`);
        assert.deepEqual(details[0][1], { e: [404, { message: 'not-found', code: 'NOT_FOUND' }] });
        assert.doesNotMatch(JSON.stringify(details[0]), /Private deleted label/);
      }
      assert.equal((await h.query('listSchemaCollections')).length, 1);
    } finally { await h.close(); }
  });

  test(`${target}: denied deletion returns no private cache payload before schema storage`, async () => {
    const h = await schemaAdminRemotes(target);
    try {
      await h.registry.createCollection({ slug: 'posts', label: 'Private deleted label' });
      const c = await h.query('getSchemaCollection', 'posts');
      const before = await h.snapshot();
      h.probeStorage();
      const result = await h.remote('deleteSchemaCollection', 'author', { collection: 'posts', id: 'posts',
        version: String(c.version), updatedAt: c.updatedAt });
      assert.equal(result.type, 'error'); assert.equal(result.status, 403);
      assert.equal(result.error.code, 'INSUFFICIENT_PERMISSIONS');
      assert.equal(result.data, undefined); assert.equal(result.q, undefined);
      assert.doesNotMatch(JSON.stringify(result), /Private deleted label/);
      assert.equal(h.storageReads, 0); assert.deepEqual(await h.snapshot(), before);
    } finally { await h.close(); }
  });
}
