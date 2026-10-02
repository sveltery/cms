// Original supplemental service/storage tests for the bounded label-only operation,
// plus the explicitly marked partial source assertion below.
// Behavior reference: EmDash 1.1.0, immutable
// 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e:packages/core/src/schema/registry.ts:1542
// and packages/core/src/api/schemas/schema.ts:232. These tests do not port a full
// source declaration: registry.test.ts:668 also asserts sortOrder and widget.
// Selected assertion copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'kysely';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { CmsDatabase, Collection, Field, FieldRow } from '../src/lib/server/database/contract.ts';
import { cmsService, type ServerPrincipal } from '../src/lib/server/database/service.ts';
import { SchemaRegistry } from '../src/lib/server/database/registry.ts';
import { migrateCms } from '../src/lib/server/database/migrations.ts';
import { schemaAdminStorage } from './helpers/schema-admin-storage.ts';

const admin: ServerPrincipal = { id: 'admin', permissions: ['schema:manage', 'schema:read',
  'content:create', 'content:read', 'content:read_drafts', 'content:edit_any'] };
const expected = (collection: { version: number; updatedAt: string }) => ({ version: collection.version, updatedAt: collection.updatedAt });
const objects = async (database: CmsDatabase) =>
  (await sql`SELECT name, sql FROM sqlite_master WHERE name != '_cf_METADATA' ORDER BY name`.execute(database.db)).rows;
const snapshot = async (database: CmsDatabase, table = 'ec_posts') => ({
  objects: await objects(database),
  columns: (await sql`PRAGMA table_info(${sql.ref(table)})`.execute(database.db)).rows,
  content: (await sql`SELECT * FROM ${sql.ref(table)} ORDER BY id`.execute(database.db)).rows,
  collections: await database.db.selectFrom('_cms_collections').selectAll().orderBy('id').execute(),
  fields: (await database.db.selectFrom('_cms_fields').selectAll().orderBy('id').execute()).map(row => ({ ...row })),
  migrations: await database.db.selectFrom('_cms_migrations').selectAll().orderBy('version').execute(),
  guards: await database.db.selectFrom('_cms_guards').selectAll().orderBy('token').execute()
});

test('field label: permission precedes hostile input and all storage access', async () => {
  let touched = 0;
  const database = new Proxy({} as CmsDatabase, { get() { touched++; throw new Error('storage accessed'); } });
  const hostile = Object.defineProperty({}, 'collection', { get() { throw new Error('input accessed'); }, enumerable: true });
  for (const [principal, code] of [[null, 'UNAUTHENTICATED'],
    [{ id: 'reader', permissions: ['schema:read'] }, 'FORBIDDEN'],
    [{ id: 'editor', permissions: ['content:edit_any'] }, 'FORBIDDEN'],
    [{ id: '', permissions: ['schema:manage'] }, 'UNAUTHENTICATED']] as const) {
    await assert.rejects(() => cmsService(database, principal).updateFieldLabel(hostile), { code });
    await assert.rejects(() => cmsService(database, principal).updateFieldLabel(null), { code });
  }
  assert.equal(touched, 0);
});

for (const target of ['Node', 'D1'] as const) {
  async function fixture(directory?: string) {
    const storage = await schemaAdminStorage(target, directory);
    await migrateCms(storage.database);
    const registry = new SchemaRegistry(storage.database);
    await registry.createCollection({ slug: 'posts', label: 'Posts', labelSingular: 'Post', description: 'Existing description' });
    const title = await registry.createField('posts', { slug: 'title', label: 'Title', type: 'string',
      required: true, unique: true, defaultValue: 'fallback', validation: { minLength: 2, maxLength: 90 } });
    const body = await registry.createField('posts', { slug: 'body', label: 'Body', type: 'text',
      defaultValue: 'body default', validation: { maxLength: 1200 } });
    const service = cmsService(storage.database, admin);
    const entry = await service.createDraft({ type: 'posts', slug: 'saved', data: { title: 'Stored title', body: 'Stored body' } });
    const collection = await registry.getCollection('posts'); assert.ok(collection);
    return { ...storage, registry, service, title, body, entry, collection };
  }

  // Partial assertion from immutable
  // 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e:packages/core/tests/unit/schema/registry.test.ts:668.
  // Preserves the label value/assertion with node:assert instead of Vitest;
  // sortOrder/widget assertions and full source-declaration credit remain deferred.
  test(`${target}: selected partial registry.test.ts:668 label assertion`, { timeout: 30000 }, async () => {
    const f = await fixture();
    try {
      const updated = await f.registry.updateFieldLabel('posts', 'title', { label: 'Post Title' });
      assert.equal(updated.label, 'Post Title');
    } finally { await f.close(); }
  });

  test(`${target}: string/text labels persist across restart while all other metadata, DDL, indexes, content and tokens remain unchanged`, { timeout: 30000 }, async () => {
    const directory = await mkdtemp(join(tmpdir(), 'cms-field-label-'));
    const f = await fixture(directory);
    let storage: Pick<typeof f, 'database' | 'close'> = f;
    try {
      const before = await snapshot(f.database);
      const labels = new Map([[f.title.id, ' Article title '], [f.body.id, 'Article body']]);
      const title = await f.service.updateFieldLabel({ collection: 'posts', field: 'title', label: labels.get(f.title.id) });
      const body = await f.registry.updateFieldLabel('posts', 'body', { label: labels.get(f.body.id) });
      assert.deepEqual(title, { ...f.title, label: labels.get(f.title.id) });
      assert.deepEqual(body, { ...f.body, label: labels.get(f.body.id) });
      const after = await snapshot(f.database);
      assert.deepEqual(after, { ...before, fields: before.fields.map(field => ({ ...field, label: labels.get(field.id) ?? field.label })) });
      assert.deepEqual(await f.service.getDraft({ type: 'posts', id: f.entry.id }), f.entry);
      assert.deepEqual(await f.registry.getCollection('posts'), f.collection);
      const manifest = await f.service.getEditorManifest();
      assert.equal(manifest.collections.posts.fields.title.label, labels.get(f.title.id));
      assert.equal(manifest.collections.posts.fields.body.label, labels.get(f.body.id));
      await f.close();
      storage = await schemaAdminStorage(target, directory);
      assert.deepEqual(await snapshot(storage.database), after);
      const reopened = cmsService(storage.database, admin);
      assert.deepEqual((await reopened.getCollection('posts')).fields, [title, body]);
      assert.deepEqual(await reopened.getDraft({ type: 'posts', id: f.entry.id }), f.entry);
      // Label editing leaves the existing content mutation token valid.
      const edited = await reopened.updateDraft({ type: 'posts', id: f.entry.id,
        expected: expected(f.entry), data: { body: 'Content still editable' } });
      assert.equal(edited.data.body, 'Content still editable');
    } finally { await storage.close(); await rm(directory, { recursive: true, force: true }); }
  });

  test(`${target}: strict label-only validation rejects extra properties and invalid targets before storage without writes`, { timeout: 30000 }, async () => {
    const f = await fixture(); let touched = 0;
    const guarded = new Proxy(f.database, { get(target, key, receiver) {
      if (key === 'db' || key === 'atomicBatch') touched++;
      return Reflect.get(target, key, receiver);
    } });
    const service = cmsService(guarded, admin);
    const registry = new SchemaRegistry(guarded);
    try {
      const before = await snapshot(f.database);
      const valid = { collection: 'posts', field: 'title', label: 'Changed' };
      for (const input of [null, undefined, [], {}, { ...valid, label: '' }, { ...valid, label: null },
        { ...valid, label: 1 }, { ...valid, label: undefined }, { ...valid, collection: '../posts' },
        { ...valid, field: '../title' }, { ...valid, collection: '' }, { ...valid, field: '' },
        { ...valid, input: { label: 'Nested' } }, { ...valid, expected: expected(f.collection) },
        { ...valid, expectedSchemaVersion: f.collection.version }, { ...valid, id: f.title.id },
        { ...valid, authorId: 'forged' }, { ...valid, permissions: ['schema:manage'] }]) {
        await assert.rejects(() => service.updateFieldLabel(input), { code: 'VALIDATION_ERROR' });
      }
      for (const key of ['slug', 'type', 'columnType', 'required', 'unique', 'defaultValue', 'validation',
        'sortOrder', 'widget', 'indexed', 'searchable', 'translatable', 'createdAt', 'collectionId']) {
        await assert.rejects(() => service.updateFieldLabel({ ...valid, [key]: 'unrequested' }), { code: 'VALIDATION_ERROR' });
        await assert.rejects(() => registry.updateFieldLabel('posts', 'title', { label: 'Changed', [key]: 'unrequested' }), { code: 'VALIDATION_ERROR' });
      }
      for (const input of [null, [], {}, { label: '' }, { label: 1 }, { label: 'Changed', expected: expected(f.collection) }]) {
        await assert.rejects(() => registry.updateFieldLabel('posts', 'title', input), { code: 'VALIDATION_ERROR' });
      }
      assert.equal(touched, 0);
      assert.deepEqual(await snapshot(f.database), before);
    } finally { await f.close(); }
  });

  test(`${target}: whitespace and labels longer than 200 characters retain the pinned nonempty-only contract`, { timeout: 30000 }, async () => {
    const f = await fixture();
    try {
      for (const label of [' ', '  Title\t\n ', 'x'.repeat(201), 'Long '.repeat(2000)]) {
        const result = await f.service.updateFieldLabel({ collection: 'posts', field: 'title', label });
        assert.equal(result.label, label);
        assert.equal((await f.registry.getField('posts', 'title'))?.label, label);
      }
      assert.deepEqual(await f.registry.getCollection('posts'), f.collection);
    } finally { await f.close(); }
  });

  test(`${target}: schema:manage alone can relabel and schema/content readers cannot mutate any row`, { timeout: 30000 }, async () => {
    const f = await fixture();
    try {
      const before = await snapshot(f.database);
      for (const principal of [null, { id: 'reader', permissions: ['schema:read'] },
        { id: 'editor', permissions: ['content:read', 'content:read_drafts', 'content:edit_any'] }] as const) {
        await assert.rejects(() => cmsService(f.database, principal).updateFieldLabel({ collection: 'posts', field: 'title', label: 'Denied' }),
          { code: principal ? 'FORBIDDEN' : 'UNAUTHENTICATED' });
        assert.deepEqual(await snapshot(f.database), before);
      }
      const result = await cmsService(f.database, { id: 'manager', permissions: ['schema:manage'] })
        .updateFieldLabel({ collection: 'posts', field: 'title', label: 'Manager label' });
      assert.deepEqual(result, { ...f.title, label: 'Manager label' });
    } finally { await f.close(); }
  });

  test(`${target}: identical labels are successful no-op values and same-field concurrent edits are last-writer-wins`, { timeout: 30000 }, async () => {
    const f = await fixture(); let raced = false;
    const racing = { ...f.database, async atomicBatch(statements) {
      if (!raced) {
        raced = true;
        await f.service.updateFieldLabel({ collection: 'posts', field: 'title', label: 'Earlier writer' });
      }
      return f.database.atomicBatch(statements);
    } } satisfies CmsDatabase;
    try {
      const before = await snapshot(f.database);
      assert.deepEqual(await f.service.updateFieldLabel({ collection: 'posts', field: 'title', label: 'Title' }), f.title);
      assert.deepEqual(await snapshot(f.database), before);
      const latest = await cmsService(racing, admin).updateFieldLabel({ collection: 'posts', field: 'title', label: 'Last writer' });
      assert.equal(latest.label, 'Last writer'); assert.equal(raced, true);
      assert.deepEqual(await f.registry.getField('posts', 'title'), latest);
      assert.deepEqual(await f.registry.getCollection('posts'), f.collection);
      const same = await f.service.updateFieldLabel({ collection: 'posts', field: 'title', label: 'Last writer' });
      assert.deepEqual(same, latest);
    } finally { await f.close(); }
  });

  test(`${target}: independent fields keep separate results and do not change each other's attributes`, { timeout: 30000 }, async () => {
    const f = await fixture();
    try {
      const results = await Promise.all([
        f.service.updateFieldLabel({ collection: 'posts', field: 'title', label: 'Independent title' }),
        f.service.updateFieldLabel({ collection: 'posts', field: 'body', label: 'Independent body' })
      ]);
      assert.deepEqual(results, [{ ...f.title, label: 'Independent title' }, { ...f.body, label: 'Independent body' }]);
      assert.deepEqual((await f.service.getCollection('posts')).fields, results);
      assert.deepEqual(await f.registry.getCollection('posts'), f.collection);
    } finally { await f.close(); }
  });

  test(`${target}: a pre-label collection metadata token remains valid and metadata forms cannot overwrite field labels`, { timeout: 30000 }, async () => {
    const f = await fixture();
    try {
      const label = await f.service.updateFieldLabel({ collection: 'posts', field: 'title', label: 'New title' });
      const changed = await f.service.updateCollection({ collection: 'posts', expected: expected(f.collection),
        input: { label: 'Articles', description: 'Updated metadata' } });
      assert.equal(changed.label, 'Articles'); assert.equal(changed.version, f.collection.version);
      assert.deepEqual(await f.registry.getField('posts', 'title'), label);
      const relabeled = await f.service.updateFieldLabel({ collection: 'posts', field: 'body', label: 'New body' });
      assert.deepEqual(await f.registry.getCollection('posts'), changed);
      assert.deepEqual(await f.registry.getField('posts', 'body'), relabeled);
      const before = await snapshot(f.database);
      await assert.rejects(() => f.service.updateCollection({ collection: 'posts', expected: expected(changed),
        input: { fields: [{ slug: 'title', label: 'Stale title' }] } }), { code: 'VALIDATION_ERROR' });
      assert.deepEqual(await snapshot(f.database), before);
    } finally { await f.close(); }
  });

  test(`${target}: metadata writes between label preflight and commit neither conflict nor lose either update`, { timeout: 30000 }, async () => {
    const f = await fixture(); let metadata: Collection | undefined;
    const racing = { ...f.database, async atomicBatch(statements) {
      metadata = await f.service.updateCollection({ collection: 'posts', expected: expected(f.collection),
        input: { description: 'Concurrent metadata' } });
      return f.database.atomicBatch(statements);
    } } satisfies CmsDatabase;
    try {
      const label = await cmsService(racing, admin).updateFieldLabel({ collection: 'posts', field: 'title', label: 'Concurrent label' });
      assert.equal(label.label, 'Concurrent label'); assert.ok(metadata);
      assert.deepEqual(await f.registry.getCollection('posts'), metadata);
      assert.deepEqual(await f.registry.getField('posts', 'title'), label);
    } finally { await f.close(); }
  });

  test(`${target}: label writes during metadata preflight leave metadata CAS valid and preserve both updates`, { timeout: 30000 }, async () => {
    const f = await fixture(); let label: Field | undefined;
    const racing = { ...f.database, async atomicBatch(statements) {
      label = await f.service.updateFieldLabel({ collection: 'posts', field: 'title', label: 'Label winner' });
      return f.database.atomicBatch(statements);
    } } satisfies CmsDatabase;
    try {
      const metadata = await cmsService(racing, admin).updateCollection({ collection: 'posts', expected: expected(f.collection), input: { label: 'Metadata winner' } });
      assert.equal(metadata.label, 'Metadata winner'); assert.ok(label);
      assert.deepEqual(await f.registry.getField('posts', 'title'), label);
      assert.deepEqual(await f.registry.getCollection('posts'), metadata);
    } finally { await f.close(); }
  });

  test(`${target}: additive fields coexist with label edits even when schema version changes after preflight`, { timeout: 30000 }, async () => {
    const f = await fixture(); let added: Field | undefined;
    const racing = { ...f.database, async atomicBatch(statements) {
      added = await f.service.addField({ collection: 'posts', expectedSchemaVersion: f.collection.version,
        input: { slug: 'summary', label: 'Summary', type: 'text' } });
      return f.database.atomicBatch(statements);
    } } satisfies CmsDatabase;
    try {
      const label = await cmsService(racing, admin).updateFieldLabel({ collection: 'posts', field: 'title', label: 'Relabeled after add' });
      assert.equal(label.label, 'Relabeled after add'); assert.ok(added);
      assert.deepEqual(await f.registry.getField('posts', 'summary'), added);
      const collection = await f.registry.getCollection('posts'); assert.ok(collection);
      assert.equal(collection.version, f.collection.version + 1);
      const labelsOnly = await f.service.updateFieldLabel({ collection: 'posts', field: 'body', label: 'Body after add' });
      assert.equal(labelsOnly.label, 'Body after add');
      assert.deepEqual(await f.registry.getCollection('posts'), collection);
      const next = await f.service.addField({ collection: 'posts', expectedSchemaVersion: collection.version,
        input: { slug: 'other', label: 'Other', type: 'string' } });
      assert.equal(next.slug, 'other');
      assert.deepEqual(await f.registry.getField('posts', 'title'), label);
    } finally { await f.close(); }
  });

  test(`${target}: collection/field target pairs isolate same-slug fields and missing targets write nothing`, { timeout: 30000 }, async () => {
    const f = await fixture();
    try {
      await f.registry.createCollection({ slug: 'other', label: 'Other' });
      const other = await f.registry.createField('other', { slug: 'title', label: 'Other title', type: 'string' });
      const before = await snapshot(f.database);
      for (const [collection, field] of [['missing', 'title'], ['posts', 'missing'], ['other', 'body']]) {
        await assert.rejects(() => f.service.updateFieldLabel({ collection, field, label: 'Missing' }), { code: 'NOT_FOUND' });
        assert.deepEqual(await snapshot(f.database), before);
      }
      await f.service.updateFieldLabel({ collection: 'posts', field: 'title', label: 'Only posts' });
      assert.deepEqual(await f.registry.getField('other', 'title'), other);
    } finally { await f.close(); }
  });

  for (const replacement of [false, true]) {
    test(`${target}: ${replacement ? 'replacement' : 'deletion'} of a field after preflight cannot relabel a different identity or report success`, { timeout: 30000 }, async () => {
      const f = await fixture(); let afterRace: Awaited<ReturnType<typeof snapshot>> | undefined;
      const racing = { ...f.database, async atomicBatch(statements) {
        const old = await f.database.db.selectFrom('_cms_fields').selectAll().where('id', '=', f.title.id).executeTakeFirstOrThrow();
        await f.database.db.deleteFrom('_cms_fields').where('id', '=', f.title.id).execute();
        if (replacement) await f.database.db.insertInto('_cms_fields').values({ ...old, id: 'replacement-title', label: 'Replacement title' }).execute();
        afterRace = await snapshot(f.database);
        return f.database.atomicBatch(statements);
      } } satisfies CmsDatabase;
      try {
        await assert.rejects(() => cmsService(racing, admin).updateFieldLabel({ collection: 'posts', field: 'title', label: 'Stale request' }), { code: 'NOT_FOUND' });
        assert.ok(afterRace); assert.deepEqual(await snapshot(f.database), afterRace);
      } finally { await f.close(); }
    });
  }

  test(`${target}: replacement of a collection and its same-slug fields after preflight preserves the replacement identities`, { timeout: 30000 }, async () => {
    const f = await fixture(); let afterRace: Awaited<ReturnType<typeof snapshot>> | undefined;
    const racing = { ...f.database, async atomicBatch(statements) {
      const old = await f.database.db.selectFrom('_cms_collections').selectAll().where('id', '=', f.collection.id).executeTakeFirstOrThrow();
      const fields = await f.database.db.selectFrom('_cms_fields').selectAll().where('collection_id', '=', old.id).execute();
      await f.database.db.deleteFrom('_cms_fields').where('collection_id', '=', old.id).execute();
      await f.database.db.deleteFrom('_cms_collections').where('id', '=', old.id).execute();
      await f.database.db.insertInto('_cms_collections').values({ ...old, id: 'replacement-collection' }).execute();
      await f.database.db.insertInto('_cms_fields').values(fields.map(field => ({ ...field,
        id: 'replacement-' + field.slug, collection_id: 'replacement-collection', label: 'Replacement ' + field.slug }))).execute();
      afterRace = await snapshot(f.database);
      return f.database.atomicBatch(statements);
    } } satisfies CmsDatabase;
    try {
      await assert.rejects(() => cmsService(racing, admin).updateFieldLabel({ collection: 'posts', field: 'title', label: 'Stale request' }), { code: 'NOT_FOUND' });
      assert.ok(afterRace); assert.deepEqual(await snapshot(f.database), afterRace);
    } finally { await f.close(); }
  });

  test(`${target}: failures during and after the label UPDATE roll back every row and retain unexpected storage errors`, { timeout: 30000 }, async () => {
    const f = await fixture();
    try {
      await sql`CREATE TRIGGER reject_label BEFORE UPDATE OF label ON _cms_fields BEGIN SELECT RAISE(ABORT, 'unexpected_label_failure'); END`.execute(f.database.db);
      const before = await snapshot(f.database);
      await assert.rejects(() => f.service.updateFieldLabel({ collection: 'posts', field: 'title', label: 'Rejected' }), /unexpected_label_failure/);
      assert.deepEqual(await snapshot(f.database), before);
      await sql`DROP TRIGGER reject_label`.execute(f.database.db);
      const withoutTrigger = await snapshot(f.database);
      const failing = { ...f.database, atomicBatch(statements) {
        return f.database.atomicBatch([...statements, sql`SELECT * FROM missing_label_failure`.compile(f.database.db)]);
      } } satisfies CmsDatabase;
      await assert.rejects(() => cmsService(failing, admin).updateFieldLabel({ collection: 'posts', field: 'title', label: 'Rolled back' }), /missing_label_failure/);
      assert.deepEqual(await snapshot(f.database), withoutTrigger);
    } finally { await f.close(); }
  });

  test(`${target}: the returned field belongs to this atomic write even when another label commits before the adapter returns`, { timeout: 30000 }, async () => {
    const f = await fixture(); let later: Field | undefined;
    const delayed = { ...f.database, async atomicBatch(statements) {
      const results = await f.database.atomicBatch(statements);
      later = await f.service.updateFieldLabel({ collection: 'posts', field: 'title', label: 'Later label' });
      return results;
    } } satisfies CmsDatabase;
    try {
      const first = await cmsService(delayed, admin).updateFieldLabel({ collection: 'posts', field: 'title', label: 'First label' });
      assert.deepEqual(first, { ...f.title, label: 'First label' });
      assert.deepEqual(later, { ...f.title, label: 'Later label' });
      assert.deepEqual(await f.registry.getField('posts', 'title'), later);
      assert.deepEqual(await f.registry.getCollection('posts'), f.collection);
    } finally { await f.close(); }
  });

  test(`${target}: relabeling legacy columns retains divergent defaults, required layout, unique indexes and stored NULL values`, { timeout: 30000 }, async () => {
    const directory = await mkdtemp(join(tmpdir(), 'cms-field-label-legacy-'));
    const f = await fixture(directory);
    let storage: Pick<typeof f, 'database' | 'close'> = f;
    try {
      const legacy = await f.registry.createCollection({ slug: 'legacy', label: 'Legacy' });
      await sql`ALTER TABLE ec_legacy ADD COLUMN title TEXT DEFAULT 'physical old default'`.execute(f.database.db);
      await sql`ALTER TABLE ec_legacy ADD COLUMN body TEXT NOT NULL`.execute(f.database.db);
      await sql`CREATE UNIQUE INDEX legacy_title_unique ON ec_legacy(title)`.execute(f.database.db);
      const old = await f.database.db.selectFrom('_cms_fields').selectAll().where('collection_id', '=', f.collection.id).execute();
      const legacyFields: FieldRow[] = old.map(field => ({ ...field, id: 'legacy-' + field.slug, collection_id: legacy.id,
        required: field.slug === 'body' ? 1 : 0, unique: field.slug === 'title' ? 1 : 0,
        default_value: field.slug === 'title' ? JSON.stringify('metadata new default') : null }));
      await f.database.db.insertInto('_cms_fields').values(legacyFields).execute();
      await sql`INSERT INTO ec_legacy(id, title, body) VALUES ('saved', NULL, 'Stored legacy body'), ('unique', 'Existing unique value', 'Body')`.execute(f.database.db);
      const before = await snapshot(f.database, 'ec_legacy');
      await f.service.updateFieldLabel({ collection: 'legacy', field: 'title', label: 'Legacy title relabeled' });
      await f.service.updateFieldLabel({ collection: 'legacy', field: 'body', label: 'Legacy body relabeled' });
      const labels = new Map([['legacy-title', 'Legacy title relabeled'], ['legacy-body', 'Legacy body relabeled']]);
      const after = await snapshot(f.database, 'ec_legacy');
      assert.deepEqual(after, { ...before, fields: before.fields.map(field => ({ ...field, label: labels.get(field.id) ?? field.label })) });
      await f.close(); storage = await schemaAdminStorage(target, directory);
      assert.deepEqual(await snapshot(storage.database, 'ec_legacy'), after);
      await assert.rejects(() => sql`INSERT INTO ec_legacy(id, title, body) VALUES ('duplicate', 'Existing unique value', 'Body')`.execute(storage.database.db));
      await assert.rejects(() => sql`INSERT INTO ec_legacy(id) VALUES ('missing-required')`.execute(storage.database.db));
      await sql`INSERT INTO ec_legacy(id, body) VALUES ('default', 'Body')`.execute(storage.database.db);
      assert.equal((await sql<{ title: string }>`SELECT title FROM ec_legacy WHERE id = 'default'`.execute(storage.database.db)).rows[0].title, 'physical old default');
    } finally { await storage.close(); await rm(directory, { recursive: true, force: true }); }
  });
}
