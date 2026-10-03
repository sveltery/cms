// Supplemental trusted-boundary and descriptor-disclosure checks; no source declaration credit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'kysely';
import { schemaAdminRemotes } from '../helpers/schema-admin-remotes.ts';

for (const target of ['Node', 'D1'] as const) {
  test(`${target}: public descriptors forward supported metadata and omit private validation/default/storage data`, async () => {
    const h = await schemaAdminRemotes(target);
    try {
      await h.registry.createCollection({ slug: 'meta', label: 'Metadata', supports: ['drafts', 'revisions', 'preview', 'scheduling', 'search', 'seo'],
        hasSeo: true, urlPattern: '/meta/{slug}', routable: false, hidden: true, icon: 'note', group: 'Tools', admin: { quickCreate: false } });
      await h.registry.createField('meta', { slug: 'choice', label: 'Choice', type: 'select', widget: 'radio',
        options: { rows: 4 }, validation: { options: ['red', 'blue'] }, translatable: false });
      await h.registry.createField('meta', { slug: 'rows', label: 'Rows', type: 'repeater' });
      const validation = { required: true, min: 1, max: 5, minLength: 2, maxLength: 10, pattern: '^x$',
        minItems: 1, maxItems: 3, allowedMimeTypes: ['image/png'], relation: 'meta_link', relationSide: 'parent',
        targetCollection: 'meta', multiple: true, allowedTypes: ['hero'], retiredTypes: ['old'],
        subFields: [{ slug: 'name', label: 'Name', type: 'string', required: true, options: ['x'] }] };
      await sql`UPDATE _cms_fields SET default_value = '"Private default"', validation = ${JSON.stringify({
        ...validation, privateNote: 'Private outer metadata', subFields: [{ ...validation.subFields[0], privateNote: 'Private nested metadata' }]
      })} WHERE slug = 'rows'`.execute(h.database.db);
      const collection = (await h.query('getEditorManifest')).collections.meta;
      assert.deepEqual(collection.supports, ['drafts', 'revisions', 'preview', 'scheduling', 'search', 'seo']);
      assert.equal(collection.hasSeo, true); assert.equal(collection.routable, false); assert.equal(collection.urlPattern, '/meta/{slug}');
      assert.equal(collection.hidden, true); assert.equal(collection.quickCreate, false);
      const choice = collection.fields.choice;
      assert.equal(choice.widget, 'radio'); assert.equal(choice.translatable, false);
      assert.deepEqual(choice.options, [{ value: 'red', label: 'Red' }, { value: 'blue', label: 'Blue' }]);
      assert.deepEqual(choice.validation, { options: ['red', 'blue'] });
      assert.deepEqual(collection.fields.rows.validation, validation);
      assert.doesNotMatch(JSON.stringify(collection), /Private|privateNote|defaultValue|columnType|collectionId|createdAt|indexed|searchable/);
    } finally { await h.close(); }
  });

  test(`${target}: malformed stored regex stops content writes and native errors conceal server exceptions`, async () => {
    const h = await schemaAdminRemotes(target);
    try {
      await h.registry.createCollection({ slug: 'legacy', label: 'Legacy' });
      await h.registry.createField('legacy', { slug: 'value', label: 'Value', type: 'string' });
      await sql`UPDATE _cms_fields SET validation = '{"pattern":"["}' WHERE slug = 'value'`.execute(h.database.db);
      const response = await h.remote('createContent', 'author', { collection: 'legacy', data: '{}' });
      assert.equal(response.type, 'error'); assert.equal(response.status, 500);
      assert.equal(response.error.message, 'Internal Error');
      assert.doesNotMatch(JSON.stringify(response), /SyntaxError|RegExp|stack|pattern|SELECT|ec_legacy|_cms_fields/);
      assert.deepEqual((await sql`SELECT * FROM ec_legacy`.execute(h.database.db)).rows, []);
    } finally { await h.close(); }
  });
}
