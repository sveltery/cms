// Adapted assertions from EmDash 1.1.0 immutable
// 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e: unit/runtime/manifest-build.test.ts
// declarations 158/178/257/386/406/581, blob 91f8fddb1472831b984034daa9776edd31d98e07.
// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// Full runtime generation becomes the registered Kit editing-manifest query.
// Persisted registry setup replaces the full runtime/config/plugin fixture.
// Unknown types/invalid list metadata use explicit raw fixtures; no schema
// administration, config collection, plugin or whole runtime manifest credit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'kysely';
import { fullContentFixture } from '../helpers/full-content-fixture.ts';

for (const target of ['Node', 'D1'] as const) {
  test(`${target}: manifest-build.test.ts:158 publishes sidebar icon and group for database collections`, async () => {
    const h = await fullContentFixture(target);
    try {
      await h.registry.createCollection({ slug: 'calendar_entries', label: 'Entries', icon: 'calendar-blank', group: 'Calendar' });
      await h.registry.createCollection({ slug: 'team', label: 'Team' });
      const manifest = await h.query('getEditorManifest');
      assert.equal(manifest.collections.calendar_entries.icon, 'calendar-blank');
      assert.equal(manifest.collections.calendar_entries.group, 'Calendar');
      assert.equal(Object.hasOwn(manifest.collections.team, 'icon'), false);
      assert.equal(Object.hasOwn(manifest.collections.team, 'group'), false);
    } finally { await h.close(); }
  });

  test(`${target}: manifest-build.test.ts:178 publishes dashboard quick-action opt-out only when set`, async () => {
    const h = await fullContentFixture(target);
    try {
      await h.registry.createCollection({ slug: 'sync_runs', label: 'Sync runs', admin: { quickCreate: false } });
      await h.registry.createCollection({ slug: 'team', label: 'Team', admin: { listColumns: [] } });
      const manifest = await h.query('getEditorManifest');
      assert.equal(manifest.collections.sync_runs?.quickCreate, false);
      assert.equal(Object.hasOwn(manifest.collections.team, 'quickCreate'), false);
    } finally { await h.close(); }
  });

  test(`${target}: manifest-build.test.ts:386 includes field definitions built via the two-query JOIN`, async () => {
    const h = await fullContentFixture(target);
    try {
      await sql`UPDATE _cms_fields SET type = 'json' WHERE slug = 'body'`.execute(h.database.db);
      const manifest = await h.query('getEditorManifest');
      const posts = manifest.collections.posts;
      assert.notEqual(posts, undefined);
      assert.equal(posts?.fields.title?.kind, 'string');
      assert.equal(posts?.fields.body?.kind, 'json');
    } finally { await h.close(); }
  });

  test(`${target}: manifest-build.test.ts:406 forwards declared validation on every field type`, async () => {
    const h = await fullContentFixture(target);
    try {
      await sql`UPDATE _cms_fields SET validation = ${JSON.stringify({ minLength: 3, maxLength: 80 })} WHERE slug = 'title'`.execute(h.database.db);
      await sql`UPDATE _cms_fields SET type = 'text', validation = ${JSON.stringify({ maxLength: 160 })} WHERE slug = 'excerpt'`.execute(h.database.db);
      await sql`UPDATE _cms_fields SET type = 'integer' WHERE slug = 'reading_minutes'`.execute(h.database.db);
      const collection = await h.registry.getCollection('posts'); assert.ok(collection);
      await sql`INSERT INTO _cms_fields(id,collection_id,slug,label,type,column_type,required,"unique",sort_order,created_at)
        VALUES ('source-subtitle',${collection.id},'subtitle','Subtitle','string','TEXT',0,0,20,${new Date().toISOString()})`.execute(h.database.db);
      const fields = (await h.query('getEditorManifest')).collections.posts?.fields;
      assert.deepEqual(fields?.title?.validation, { minLength: 3, maxLength: 80 });
      assert.deepEqual(fields?.excerpt?.validation, { maxLength: 160 });
      assert.deepEqual(fields?.reading_minutes?.validation, { min: 1, max: 60 });
      assert.equal(fields?.subtitle?.validation, undefined);
    } finally { await h.close(); }
  });

  test(`${target}: manifest-build.test.ts:257 marks unknown database field types as unsupported`, async () => {
    const h = await fullContentFixture(target);
    try {
      const collection = await h.registry.createCollection({ slug: 'imports', label: 'Imports', labelSingular: 'Import' });
      await sql`INSERT INTO _cms_fields(id,collection_id,slug,label,type,column_type,required,"unique",sort_order,created_at)
        VALUES ('field_unknown_type',${collection.id},'payload','Payload','unknown_plugin_type','TEXT',0,0,0,${new Date().toISOString()})`.execute(h.database.db);
      const field = (await h.query('getEditorManifest')).collections.imports?.fields.payload;
      assert.ok(field);
      assert.equal(field.kind, 'unsupported');
      assert.equal(field.label, 'Payload');
      assert.deepEqual(field.unsupportedType, { type: 'unknown_plugin_type', path: 'type' });
    } finally { await h.close(); }
  });

  test(`${target}: manifest-build.test.ts:581 publishes supported existing list columns and caps them at four`, async () => {
    const h = await fullContentFixture(target);
    const original = console.warn; let warnings = 0;
    console.warn = () => { warnings++; };
    try {
      const collection = await h.registry.createCollection({ slug: 'tickets', label: 'Tickets' });
      // Direct stored metadata isolates descriptor processing from the local
      // request boundary's maximum of four submitted list columns.
      await sql`UPDATE _cms_collections SET admin_config = ${JSON.stringify({ listColumns: [
        'ticket_number', 'ticket_number', 'details', 'missing', 'priority', 'urgent', 'queue', 'opened_at'
      ] })} WHERE id = ${collection.id}`.execute(h.database.db);
      for (const field of [
        { slug: 'ticket_number', label: 'Ticket number', type: 'string' },
        { slug: 'details', label: 'Details', type: 'json' },
        { slug: 'priority', label: 'Priority', type: 'select' },
        { slug: 'urgent', label: 'Urgent', type: 'boolean' },
        { slug: 'queue', label: 'Queue', type: 'string' },
        { slug: 'opened_at', label: 'Opened', type: 'datetime' }
      ]) await h.registry.createField('tickets', field);
      const manifest = await h.query('getEditorManifest');
      assert.deepEqual(manifest.collections.tickets?.listColumns, ['ticket_number', 'priority', 'urgent', 'queue']);
      assert.equal(warnings, 3);
    } finally { console.warn = original; await h.close(); }
  });
}
