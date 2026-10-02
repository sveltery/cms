import test from 'node:test';
import assert from 'node:assert/strict';
import { parse } from 'devalue';
import { schemaAdminRemotes } from '../helpers/schema-admin-remotes.ts';

// Supplemental registered Kit form evidence, separate from source behavior ports.
for (const target of ['Node', 'D1'] as const) {
  test(`${target}: pattern form metadata persists, refreshes manifest and authoritatively validates future content`, { timeout: 60_000 }, async () => {
    const h = await schemaAdminRemotes(target);
    try {
      await h.mutate('createSchemaCollection', { slug: 'notes', label: 'Notes' });
      await h.mutate('addSchemaField', { collection: 'notes', expectedSchemaVersion: '1', slug: 'title', label: 'Title', type: 'string', patternMode: 'set', pattern: 'cat', defaultValue: 'dog' });
      await h.mutate('addSchemaField', { collection: 'notes', expectedSchemaVersion: '2', slug: 'body', label: 'Body', type: 'text', patternMode: 'set', pattern: '' });
      let c = await h.query('getSchemaCollection', 'notes');
      assert.deepEqual(c.fields.map((field: any) => field.validation), [{ pattern: 'cat' }, { pattern: '' }]);
      let manifest = await h.query('getEditorManifest', undefined, 'author');
      assert.equal(manifest.collections.notes.fields.title.validation.pattern, 'cat');
      assert.equal(manifest.collections.notes.fields.body.validation.pattern, '');
      const created = await h.mutate('createContent', { collection: 'notes', 'data.title': 'concatenate', 'data.body': '' }, 'author');
      const contentRows = () => h.database.db.selectFrom('ec_notes' as any).selectAll().orderBy('id').execute();
      const before = await h.snapshot(); const rowsBefore = await contentRows();
      for (const value of ['CAT', 'dog', '']) {
        const failed = await h.remote('createContent', 'author', { collection: 'notes', 'data.title': value });
        assert.equal(failed.type, 'error'); assert.equal(failed.status, 400); assert.equal(failed.error.code, 'VALIDATION_ERROR');
        assert.deepEqual(await h.snapshot(), before);
        assert.deepEqual(await contentRows(), rowsBefore, 'invalid content creates perform zero row writes');
      }
      await h.mutate('updateSchemaFieldOptions', { collection: 'notes', field: 'title', validationMode: 'keep', patternMode: 'set', pattern: '[' });
      assert.equal((await h.query('getSchemaCollection', 'notes')).fields[0].validation.pattern, 'cat');
      await h.mutate('updateSchemaFieldOptions', { collection: 'notes', field: 'title', validationMode: 'set', patternMode: 'set', pattern: '^dog$', maxLength: '3' });
      assert.deepEqual((await h.query('getSchemaCollection', 'notes')).fields[0].validation, { maxLength: 3, pattern: '^dog$' });
      assert.equal((await h.query('getContent', { collection: 'notes', id: created._.result.id }, 'author')).data.title, 'concatenate', 'old content remains readable');
      await h.mutate('updateSchemaFieldOptions', { collection: 'notes', field: 'title', validationMode: 'set', patternMode: 'set', pattern: '' });
      assert.deepEqual((await h.query('getSchemaCollection', 'notes')).fields[0].validation, { pattern: '' });
      await h.mutate('createContent', { collection: 'notes', 'data.title': '' }, 'author');
      await h.mutate('updateSchemaFieldOptions', { collection: 'notes', field: 'title', validationMode: 'set', patternMode: 'omit', pattern: '[' });
      assert.deepEqual((await h.query('getSchemaCollection', 'notes')).fields[0].validation, {});
      await h.mutate('updateSchemaFieldOptions', { collection: 'notes', field: 'title', validationMode: 'clear', patternMode: 'set', pattern: '[' });
      c = await h.query('getSchemaCollection', 'notes'); assert.equal(c.fields[0].validation, null);
      manifest = await h.query('getEditorManifest', undefined, 'author');
      const snapshot = await h.snapshot(); await h.restart();
      assert.deepEqual(await h.query('getSchemaCollection', 'notes'), c);
      assert.deepEqual(await h.query('getEditorManifest', undefined, 'author'), manifest);
      assert.deepEqual(await h.snapshot(), snapshot);
    } finally { await h.close(); }
  });

  test(`${target}: selected malformed pattern issues target pattern and perform zero writes`, { timeout: 60_000 }, async () => {
    const h = await schemaAdminRemotes(target);
    try {
      await h.registry.createCollection({ slug: 'notes', label: 'Notes' });
      await h.registry.createField('notes', { slug: 'title', label: 'Title', type: 'string' });
      const before = await h.snapshot();
      for (const [name, input] of [
        ['addSchemaField', { collection: 'notes', expectedSchemaVersion: '2', slug: 'body', label: 'Body', type: 'text', patternMode: 'set', pattern: '[' }],
        ['updateSchemaFieldOptions', { collection: 'notes', field: 'title', validationMode: 'set', patternMode: 'set', pattern: '[' }]
      ] as const) {
        const result = await h.remote(name, 'admin', input);
        assert.equal(result.type, 'result');
        const data = parse(result.data); assert.equal(data._.result, undefined);
        assert.ok(data._.issues.some((issue: any) => issue.message === 'Invalid validation pattern' && issue.path?.[0] === 'pattern'));
        assert.deepEqual(await h.snapshot(), before);
      }
    } finally { await h.close(); }
  });
}
