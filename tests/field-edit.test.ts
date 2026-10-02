// Original supplemental tests for string/text metadata edits. Source reference:
// EmDash 1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e,
// packages/core/src/schema/registry.ts:1542 and api/schemas/schema.ts:232.
// This file grants no complete upstream test-declaration credit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'kysely';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cmsService, type ServerPrincipal } from '../src/lib/server/database/service.ts';
import { SchemaRegistry } from '../src/lib/server/database/registry.ts';
import { migrateCms } from '../src/lib/server/database/migrations.ts';
import type { CmsDatabase, FieldRow } from '../src/lib/server/database/contract.ts';
import { schemaAdminStorage } from './helpers/schema-admin-storage.ts';
import { fieldEditIndependentStorage } from './helpers/field-edit-storage.ts';

const admin: ServerPrincipal = { id: 'metadata-admin', permissions: ['schema:read', 'schema:manage',
  'content:create', 'content:read', 'content:read_drafts', 'content:edit_any'] };
const expected = (entry: { version: number; updatedAt: string }) => ({ version: entry.version, updatedAt: entry.updatedAt });
const snapshot = async (database: CmsDatabase, table = 'ec_posts') => ({
  objects: (await sql`SELECT name, sql FROM sqlite_master WHERE name != '_cf_METADATA' ORDER BY name`.execute(database.db)).rows,
  columns: (await sql`PRAGMA table_info(${sql.ref(table)})`.execute(database.db)).rows,
  content: (await sql`SELECT * FROM ${sql.ref(table)} ORDER BY id`.execute(database.db)).rows,
  collections: await database.db.selectFrom('_cms_collections').selectAll().orderBy('id').execute(),
  fields: (await database.db.selectFrom('_cms_fields').selectAll().orderBy('id').execute()).map(row => ({ ...row })),
  migrations: await database.db.selectFrom('_cms_migrations').selectAll().orderBy('version').execute(),
  guards: await database.db.selectFrom('_cms_guards').selectAll().orderBy('token').execute()
});

test('field edit: schema permission precedes hostile input and storage', async () => {
  let touched = 0;
  const database = new Proxy({} as CmsDatabase, { get() { touched++; throw new Error('storage accessed'); } });
  const hostile = Object.defineProperty({}, 'collection', { get() { throw new Error('input accessed'); }, enumerable: true });
  for (const [principal, code] of [[null, 'UNAUTHENTICATED'],
    [{ id: 'reader', permissions: ['schema:read'] }, 'FORBIDDEN'],
    [{ id: 'editor', permissions: ['content:edit_any'] }, 'FORBIDDEN']] as const) {
    await assert.rejects(() => cmsService(database, principal).updateField(hostile), { code });
  }
  assert.equal(touched, 0);
});

for (const target of ['Node', 'D1'] as const) {
  async function fixture(directory?: string, supplied?: Awaited<ReturnType<typeof fieldEditIndependentStorage>>) {
    const storage = supplied ?? await schemaAdminStorage(target, directory);
    await migrateCms(storage.database);
    const registry = new SchemaRegistry(storage.database);
    await registry.createCollection({ slug: 'posts', label: 'Posts' });
    const title = await registry.createField('posts', { slug: 'title', label: 'Title', type: 'string',
      required: true, unique: true, defaultValue: 'SQL original', validation: { minLength: 2, maxLength: 90 } });
    const body = await registry.createField('posts', { slug: 'body', label: 'Body', type: 'text',
      defaultValue: 'optional original', validation: { maxLength: 1200 } });
    const service = cmsService(storage.database, admin);
    const entry = await service.createDraft({ type: 'posts', data: { title: 'Stored title', body: 'Stored body' } });
    return { ...storage, registry, service, title, body, entry };
  }

  test(`${target}: field metadata persists across reopen without DDL, content, token or collection changes`, { timeout: 30000 }, async () => {
    const directory = await mkdtemp(join(tmpdir(), 'cms-field-edit-'));
    const f = await fixture(directory); let storage: Pick<typeof f, 'database' | 'close'> = f;
    try {
      const before = await snapshot(f.database);
      const title = await f.service.updateField({ collection: 'posts', field: 'title', label: '  Article title  ',
        sortOrder: 8, defaultValue: '', validation: { minLength: 20, maxLength: 25 } });
      const body = await f.service.updateField({ collection: 'posts', field: 'body', sortOrder: 0,
        defaultValue: 'new body metadata', validation: {} });
      assert.deepEqual(title, { ...f.title, label: '  Article title  ', sortOrder: 8,
        defaultValue: '', validation: { minLength: 20, maxLength: 25 } });
      assert.deepEqual(body, { ...f.body, sortOrder: 0, defaultValue: 'new body metadata', validation: {} });
      const after = await snapshot(f.database);
      assert.deepEqual(after, { ...before, fields: before.fields.map(row => row.id === title.id
        ? { ...row, label: title.label, sort_order: 8, default_value: '""', validation: '{"minLength":20,"maxLength":25}' }
        : { ...row, sort_order: 0, default_value: '"new body metadata"', validation: '{}' }) });
      assert.deepEqual(await f.service.getDraft({ type: 'posts', id: f.entry.id }), f.entry);
      assert.deepEqual((await f.service.getCollection('posts')).fields.map(field => field.slug), ['body', 'title']);
      await f.close(); storage = await schemaAdminStorage(target, directory);
      assert.deepEqual(await snapshot(storage.database), after);
      const reopened = cmsService(storage.database, admin);
      assert.deepEqual((await reopened.getCollection('posts')).fields, [body, title]);
      assert.deepEqual(await reopened.getDraft({ type: 'posts', id: f.entry.id }), f.entry);
    } finally { await storage.close(); await rm(directory, { recursive: true, force: true }); }
  });

  test(`${target}: supplied-key edits preserve omissions; validation replaces and null/empty remain distinct`, { timeout: 30000 }, async () => {
    const f = await fixture();
    try {
      const before = await snapshot(f.database);
      let batches = 0;
      const counted = { ...f.database, async atomicBatch(statements) { batches++; return f.database.atomicBatch(statements); } } satisfies CmsDatabase;
      const service = cmsService(counted, admin);
      assert.deepEqual(await service.updateField({ collection: 'posts', field: 'title' }), f.title);
      assert.deepEqual(await service.updateField({ collection: 'posts', field: 'title', label: undefined,
        sortOrder: undefined, defaultValue: undefined, validation: undefined }), f.title);
      assert.equal(batches, 0); assert.deepEqual(await snapshot(f.database), before);
      let edited = await service.updateField({ collection: 'posts', field: 'title', validation: { minLength: 250_000 } });
      assert.deepEqual(edited.validation, { minLength: 250_000 }); // No merge, upper cap, or default cross-validation.
      edited = await service.updateField({ collection: 'posts', field: 'title', label: '   ' });
      assert.deepEqual(edited, { ...f.title, label: '   ', validation: { minLength: 250_000 } });
      edited = await service.updateField({ collection: 'posts', field: 'title', validation: {} });
      assert.deepEqual(edited.validation, {});
      assert.equal((await snapshot(f.database)).fields.find(row => row.id === f.title.id)?.validation, '{}');
      edited = await service.updateField({ collection: 'posts', field: 'title', validation: null });
      assert.equal(edited.validation, null);
      assert.equal((await snapshot(f.database)).fields.find(row => row.id === f.title.id)?.validation, null);
      edited = await service.updateField({ collection: 'posts', field: 'title', label: 'x'.repeat(100_001),
        defaultValue: 'unbounded\0' + 'x'.repeat(100_001), sortOrder: 250_000 });
      assert.equal(edited.label.length, 100_001); assert.equal(edited.defaultValue?.length, 100_011);
      assert.equal(edited.sortOrder, 250_000); assert.equal(edited.validation, null);
      assert.deepEqual(await service.updateFieldLabel({ collection: 'posts', field: 'title', label: 'Compatible label' }),
        { ...edited, label: 'Compatible label' });
    } finally { await f.close(); }
  });

  test(`${target}: invalid and out-of-scope metadata fails without writes`, { timeout: 30000 }, async () => {
    const f = await fixture();
    try {
      const before = await snapshot(f.database);
      for (const input of [null, [], { label: '' }, { label: null }, { sortOrder: -1 }, { sortOrder: 1.5 },
        { sortOrder: '1' }, { sortOrder: Number.MAX_SAFE_INTEGER + 1 }, { sortOrder: 1e100 },
        { defaultValue: null }, { defaultValue: 0 }, { validation: [] },
        { validation: { minLength: -1 } }, { validation: { maxLength: 1.5 } },
        { validation: { minLength: Number.MAX_SAFE_INTEGER + 1 } }, { validation: { maxLength: 1e100 } },
        { validation: { minLength: 2, maxLength: 1 } }, { validation: { pattern: '.' } },
        { type: 'text' }, { required: true }, { unique: false }, { widget: 'text' }, { indexed: true },
        { translatable: false }, { expected: { version: 1 } }]) {
        await assert.rejects(() => f.registry.updateField('posts', 'title', input), { code: 'VALIDATION_ERROR' });
        assert.deepEqual(await snapshot(f.database), before);
      }
      await assert.rejects(() => f.service.updateField({ collection: 'posts', field: 'title', unexpected: true }), { code: 'VALIDATION_ERROR' });
      await assert.rejects(() => f.service.updateFieldLabel({ collection: 'posts', field: 'title' }), { code: 'VALIDATION_ERROR' });
      for (const [collection, field] of [['missing', 'title'], ['posts', 'missing']]) {
        await assert.rejects(() => f.service.updateField({ collection, field }), { code: 'NOT_FOUND' });
      }
      assert.deepEqual(await snapshot(f.database), before);
    } finally { await f.close(); }
  });

  test(`${target}: independent concurrent partial edits preserve both writes and each operation's own receipt`, { timeout: 30000 }, async () => {
    const f = await fixture();
    try {
      const other = cmsService(f.database, admin);
      const [label, validation] = await Promise.all([
        f.service.updateField({ collection: 'posts', field: 'title', label: 'Concurrent title' }),
        other.updateField({ collection: 'posts', field: 'title', validation: { maxLength: 80 } })
      ]);
      assert.equal(label.label, 'Concurrent title'); assert.deepEqual(validation.validation, { maxLength: 80 });
      const combined = await f.registry.getField('posts', 'title');
      assert.deepEqual(combined, { ...f.title, label: 'Concurrent title', validation: { maxLength: 80 } });
      let later;
      const delayed = { ...f.database, async atomicBatch(statements) {
        const result = await f.database.atomicBatch(statements);
        later = await other.updateField({ collection: 'posts', field: 'title', defaultValue: 'Later metadata' });
        return result;
      } } satisfies CmsDatabase;
      const first = await cmsService(delayed, admin).updateField({ collection: 'posts', field: 'title', defaultValue: 'First metadata' });
      assert.deepEqual(first, { ...combined, defaultValue: 'First metadata' });
      assert.deepEqual(later, { ...combined, defaultValue: 'Later metadata' });
      assert.deepEqual(await f.registry.getField('posts', 'title'), later);
    } finally { await f.close(); }
  });


  test(`${target}: independent storage handles make concurrent supplied-key edits without a shared mutex`, { timeout: 30000 }, async () => {
    const directory = await mkdtemp(join(tmpdir(), 'cms-field-edit-concurrent-'));
    const storage = await fieldEditIndependentStorage(target, directory);
    const f = await fixture(directory, storage);
    try {
      const before = await snapshot(f.database);
      let arrived = 0; let release!: () => void;
      const gate = new Promise<void>(resolve => { release = resolve; });
      function atCommit(database: CmsDatabase): CmsDatabase {
        return { ...database, async atomicBatch(statements) {
          if (++arrived === 2) release();
          await gate;
          return database.atomicBatch(statements);
        } };
      }
      const first = cmsService(atCommit(storage.database), admin);
      const second = cmsService(atCommit(storage.independent), admin);
      const [label, options] = await Promise.all([
        first.updateField({ collection: 'posts', field: 'title', label: 'Independent title' }),
        second.updateField({ collection: 'posts', field: 'title', sortOrder: 5, defaultValue: '', validation: {} })
      ]);
      assert.equal(arrived, 2); assert.equal(label.label, 'Independent title');
      assert.equal(options.sortOrder, 5); assert.equal(options.defaultValue, ''); assert.deepEqual(options.validation, {});
      const combined = { ...f.title, label: 'Independent title', sortOrder: 5, defaultValue: '', validation: {} };
      assert.deepEqual(await new SchemaRegistry(storage.database).getField('posts', 'title'), combined);
      assert.deepEqual(await new SchemaRegistry(storage.independent).getField('posts', 'title'), combined);
      assert.deepEqual(await snapshot(f.database), { ...before, fields: before.fields.map(row => row.id === f.title.id
        ? { ...row, label: 'Independent title', sort_order: 5, default_value: '\"\"', validation: '{}' } : row) });
    } finally { await f.close(); await rm(directory, { recursive: true, force: true }); }
  });

  test(`${target}: legacy metadata edits preserve divergent SQL defaults, required layout, unique indexes and stored NULL across reopen`, { timeout: 30000 }, async () => {
    const directory = await mkdtemp(join(tmpdir(), 'cms-field-edit-legacy-'));
    const f = await fixture(directory); let storage: Pick<typeof f, 'database' | 'close'> = f;
    try {
      const legacy = await f.registry.createCollection({ slug: 'legacy', label: 'Legacy' });
      await sql`ALTER TABLE ec_legacy ADD COLUMN title TEXT DEFAULT 'physical old default'`.execute(f.database.db);
      await sql`ALTER TABLE ec_legacy ADD COLUMN body TEXT NOT NULL`.execute(f.database.db);
      await sql`CREATE UNIQUE INDEX legacy_field_edit_title_unique ON ec_legacy(title)`.execute(f.database.db);
      const current = await f.database.db.selectFrom('_cms_fields').selectAll().where('collection_id', '=', f.title.collectionId).execute();
      const legacyFields: FieldRow[] = current.map(row => ({ ...row, id: 'legacy-' + row.slug, collection_id: legacy.id,
        required: row.slug === 'body' ? 1 : 0, unique: row.slug === 'title' ? 1 : 0,
        default_value: row.slug === 'title' ? JSON.stringify('old metadata default') : null }));
      await f.database.db.insertInto('_cms_fields').values(legacyFields).execute();
      await sql`INSERT INTO ec_legacy(id, title, body) VALUES ('saved', NULL, 'Stored legacy body'), ('unique', 'Existing unique value', 'Body')`.execute(f.database.db);
      const before = await snapshot(f.database, 'ec_legacy');
      await f.service.updateField({ collection: 'legacy', field: 'title', defaultValue: '', validation: {}, sortOrder: 8 });
      await f.service.updateField({ collection: 'legacy', field: 'body', defaultValue: 'Body metadata', validation: { maxLength: 2 }, sortOrder: 3 });
      const after = await snapshot(f.database, 'ec_legacy');
      assert.deepEqual(after, { ...before, fields: before.fields.map(row => row.id === 'legacy-title'
        ? { ...row, default_value: '\"\"', validation: '{}', sort_order: 8 }
        : row.id === 'legacy-body' ? { ...row, default_value: '\"Body metadata\"', validation: '{"maxLength":2}', sort_order: 3 } : row) });
      await f.close(); storage = await schemaAdminStorage(target, directory);
      assert.deepEqual(await snapshot(storage.database, 'ec_legacy'), after);
      await assert.rejects(() => sql`INSERT INTO ec_legacy(id, title, body) VALUES ('duplicate', 'Existing unique value', 'Body')`.execute(storage.database.db));
      await assert.rejects(() => sql`INSERT INTO ec_legacy(id) VALUES ('missing-required')`.execute(storage.database.db));
      await sql`INSERT INTO ec_legacy(id, body) VALUES ('omitted-default', 'Body')`.execute(storage.database.db);
      assert.equal((await sql<{ title: string }>`SELECT title FROM ec_legacy WHERE id = 'omitted-default'`.execute(storage.database.db)).rows[0].title, 'physical old default');
      assert.equal((await sql<{ title: null }>`SELECT title FROM ec_legacy WHERE id = 'saved'`.execute(storage.database.db)).rows[0].title, null);
    } finally { await storage.close(); await rm(directory, { recursive: true, force: true }); }
  });

  test(`${target}: validation tightening affects future supplied writes while old content remains readable`, { timeout: 30000 }, async () => {
    const f = await fixture();
    try {
      await f.service.updateField({ collection: 'posts', field: 'title', validation: { minLength: 20, maxLength: 25 } });
      const before = await snapshot(f.database);
      assert.deepEqual(await f.service.getDraft({ type: 'posts', id: f.entry.id }), f.entry);
      await assert.rejects(() => f.service.createDraft({ type: 'posts', data: { title: 'Too short' } }), { code: 'VALIDATION_ERROR' });
      await assert.rejects(() => f.service.updateDraft({ type: 'posts', id: f.entry.id, expected: expected(f.entry), data: { title: 'Too short' } }), { code: 'VALIDATION_ERROR' });
      assert.deepEqual(await snapshot(f.database), before);
      const changed = await f.service.updateDraft({ type: 'posts', id: f.entry.id, expected: expected(f.entry), data: { body: 'Future body' } });
      assert.equal(changed.data.title, f.entry.data.title);
      const valid = await f.service.updateDraft({ type: 'posts', id: f.entry.id, expected: expected(changed), data: { title: 'A valid future title!' } });
      assert.equal(valid.data.title, 'A valid future title!');
    } finally { await f.close(); }
  });

  test(`${target}: edited defaults stay metadata; omitted raw/content inserts retain physical required defaults and optional NULL`, { timeout: 30000 }, async () => {
    const f = await fixture();
    try {
      const columns = (await snapshot(f.database)).columns;
      await f.service.updateField({ collection: 'posts', field: 'title', defaultValue: 'Metadata replacement', validation: { maxLength: 1 } });
      await f.service.updateField({ collection: 'posts', field: 'body', defaultValue: '' });
      const before = await snapshot(f.database);
      await sql`INSERT INTO ec_posts(id) VALUES ('omitted-raw')`.execute(f.database.db);
      const raw = (await sql<{ title: string; body: null }>`SELECT title, body FROM ec_posts WHERE id = 'omitted-raw'`.execute(f.database.db)).rows[0];
      assert.deepEqual({ ...raw }, { title: 'SQL original', body: null });
      const omitted = await f.service.createDraft({ type: 'posts', data: {} });
      assert.deepEqual(omitted.data, { title: 'SQL original', body: null });
      assert.deepEqual((await snapshot(f.database)).columns, columns);
      assert.deepEqual((await snapshot(f.database)).fields, before.fields);
      // issue #20 remains preserved: scalar unique metadata creates no unique index.
      const duplicate = await f.service.createDraft({ type: 'posts', data: {} });
      assert.deepEqual(duplicate.data, omitted.data);
    } finally { await f.close(); }
  });

  test(`${target}: failures during/after metadata UPDATE roll back every change and retain storage errors`, { timeout: 30000 }, async () => {
    const f = await fixture();
    try {
      await sql`CREATE TRIGGER reject_field_options BEFORE UPDATE OF validation ON _cms_fields BEGIN SELECT RAISE(ABORT, 'unexpected_options_failure'); END`.execute(f.database.db);
      const before = await snapshot(f.database);
      await assert.rejects(() => f.service.updateField({ collection: 'posts', field: 'title', label: 'Rejected',
        sortOrder: 5, defaultValue: '', validation: null }), /unexpected_options_failure/);
      assert.deepEqual(await snapshot(f.database), before);
      await sql`DROP TRIGGER reject_field_options`.execute(f.database.db);
      const withoutTrigger = await snapshot(f.database);
      const failing = { ...f.database, atomicBatch(statements) {
        return f.database.atomicBatch([...statements, sql`SELECT * FROM missing_field_options_failure`.compile(f.database.db)]);
      } } satisfies CmsDatabase;
      await assert.rejects(() => cmsService(failing, admin).updateField({ collection: 'posts', field: 'title',
        label: 'Rolled back', sortOrder: 2, defaultValue: '', validation: {} }), /missing_field_options_failure/);
      assert.deepEqual(await snapshot(f.database), withoutTrigger);
    } finally { await f.close(); }
  });

  test(`${target}: field replacement between preflight and commit preserves the replacement identity`, { timeout: 30000 }, async () => {
    const f = await fixture(); let afterRace: Awaited<ReturnType<typeof snapshot>> | undefined;
    const racing = { ...f.database, async atomicBatch(statements) {
      const old = await f.database.db.selectFrom('_cms_fields').selectAll().where('id', '=', f.title.id).executeTakeFirstOrThrow();
      await f.database.db.deleteFrom('_cms_fields').where('id', '=', f.title.id).execute();
      await f.database.db.insertInto('_cms_fields').values({ ...old, id: 'replacement-field', label: 'Replacement title' }).execute();
      afterRace = await snapshot(f.database);
      return f.database.atomicBatch(statements);
    } } satisfies CmsDatabase;
    try {
      await assert.rejects(() => cmsService(racing, admin).updateField({ collection: 'posts', field: 'title',
        label: 'Stale title', sortOrder: 9, defaultValue: 'Stale default', validation: null }), { code: 'NOT_FOUND' });
      assert.ok(afterRace); assert.deepEqual(await snapshot(f.database), afterRace);
    } finally { await f.close(); }
  });
}
