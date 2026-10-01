import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sql } from 'kysely';
import { openSqlite } from '../src/lib/server/database/sqlite.ts';
import { migrateCms } from '../src/lib/server/database/migrations.ts';
import { SchemaRegistry, MAX_COLLECTIONS, MAX_FIELDS } from '../src/lib/server/database/registry.ts';
import { DraftRepository } from '../src/lib/server/database/entries.ts';
import { cmsService, type ServerPrincipal } from '../src/lib/server/database/service.ts';
import { CmsError } from '../src/lib/server/database/contract.ts';

const admin: ServerPrincipal = { id: 'admin', permissions: ['schema:read', 'schema:manage', 'content:read', 'content:read_drafts', 'content:create', 'content:edit_any', 'content:delete_any'] };
const conflict = (cause: unknown) => cause instanceof CmsError && cause.code === 'CONFLICT';
const invalid = (cause: unknown) => cause instanceof CmsError && cause.code === 'VALIDATION_ERROR';
const expected = (entry: { version: number; updatedAt: string }) => ({ version: entry.version, updatedAt: entry.updatedAt });
async function fixture(path = ':memory:') {
  const database = openSqlite(path); await migrateCms(database);
  const schema = new SchemaRegistry(database);
  await schema.createCollection({ slug: 'posts', label: 'Posts' });
  await schema.createField('posts', { slug: 'title', label: 'Title', type: 'string' });
  await schema.createField('posts', { slug: 'body', label: 'Body', type: 'text' });
  return { database, schema, entries: new DraftRepository(database), service: cmsService(database, admin) };
}

test('system migration, additive field and drafts survive close/reopen', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'cms-restart-')); const path = join(directory, 'data.sqlite');
  try {
    const first = await fixture(path);
    const created = await first.service.createDraft({ type: 'posts', data: { title: 'Persisted', body: 'Original' } });
    const schemaVersion = (await first.schema.getCollection('posts'))!.version;
    await first.service.addField({ collection: 'posts', expectedSchemaVersion: schemaVersion, input: { slug: 'subtitle', label: 'Subtitle', type: 'string', defaultValue: "it's retained" } });
    await first.database.close();
    const database = openSqlite(path);
    try {
      await migrateCms(database); await migrateCms(database);
      const service = cmsService(database, admin);
      const reread = await service.getDraft({ type: 'posts', id: created.id });
      assert.equal(reread.data.title, 'Persisted');
      assert.equal(reread.data.body, 'Original');
      assert.equal(reread.data.subtitle, "it's retained");
      assert.equal((await service.getCollection('posts')).fields.length, 3);
      assert.equal((await service.getCollection('posts')).version, schemaVersion + 1);
    } finally { await database.close(); }
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('required additive field without a backfill/default rolls back metadata and physical column', async () => {
  const f = await fixture();
  try {
    await f.service.createDraft({ type: 'posts', data: { title: 'Existing' } });
    const before = (await f.schema.getCollection('posts'))!.version;
    await assert.rejects(() => f.schema.createField('posts', { slug: 'required_later', label: 'Required', type: 'text', required: true }));
    assert.equal(await f.schema.getField('posts', 'required_later'), null);
    assert.equal((await f.schema.getCollection('posts'))!.version, before);
    const columns = (await sql<{ name: string }>`PRAGMA table_info(ec_posts)`.execute(f.database.db)).rows.map(row => row.name);
    assert.equal(columns.includes('required_later'), false);
    assert.equal((await sql`SELECT * FROM _cms_guards`.execute(f.database.db)).rows.length, 0);
  } finally { await f.database.close(); }
});

test('batch failures roll back both DDL and DML', async () => {
  const database = openSqlite(':memory:');
  try {
    await migrateCms(database);
    await assert.rejects(() => database.atomicBatch([
      sql`CREATE TABLE rollback_probe (id TEXT PRIMARY KEY)`.compile(database.db),
      sql`INSERT INTO rollback_probe VALUES ('one')`.compile(database.db),
      sql`INSERT INTO rollback_probe VALUES ('one')`.compile(database.db)
    ]));
    assert.equal((await sql`SELECT name FROM sqlite_master WHERE name = 'rollback_probe'`.execute(database.db)).rows.length, 0);
  } finally { await database.close(); }
});

test('SQL identifiers, unknown/system fields and client ownership claims are rejected; quoted values remain inert', async () => {
  const f = await fixture();
  try {
    for (const slug of ['x"; DROP TABLE _cms_fields;--', 'Posts', '9posts', 'bad-name', 'a'.repeat(64), 'reorder']) {
      await assert.rejects(() => f.service.createCollection({ slug, label: 'Attack' }));
    }
    for (const slug of ['id', 'created_at', 'status', 'author_id', 'locale', 'translation_group', 'version', 'x"']) {
      await assert.rejects(() => f.schema.createField('posts', { slug, label: 'Attack', type: 'text' }));
    }
    for (const data of [{ unknown: 'value' }, { author_id: 'admin' }, { status: 'published' }, { version: '999' }]) {
      await assert.rejects(() => f.service.createDraft({ type: 'posts', data }), invalid);
    }
    await assert.rejects(() => f.service.createDraft({ type: 'posts', authorId: 'somebody', data: { title: 'Spoof' } }), invalid);
    await assert.rejects(() => f.service.createDraft({ type: 'posts', principal: admin, data: { title: 'Spoof' } }), invalid);
    const malicious = "'; DROP TABLE ec_posts; --";
    const created = await f.service.createDraft({ type: 'posts', slug: malicious, data: { title: malicious } });
    assert.equal((await f.service.getDraft({ type: 'posts', id: created.id })).data.title, malicious);
    assert.equal((await f.service.listDrafts({ type: 'posts' })).items.length, 1);
  } finally { await f.database.close(); }
});

test('real database constraints enforce required, unique, locale slug uniqueness and foreign keys; service validates lengths', async () => {
  const f = await fixture();
  try {
    await f.schema.createField('posts', { slug: 'code', label: 'Code', type: 'string', required: true, unique: true, validation: { minLength: 2, maxLength: 4 } });
    await assert.rejects(() => f.service.createDraft({ type: 'posts', data: { title: 'Missing code' } }), invalid);
    await assert.rejects(() => f.service.createDraft({ type: 'posts', data: { code: 'x' } }), invalid);
    await assert.rejects(() => f.service.createDraft({ type: 'posts', data: { code: 'oversize' } }), invalid);
    await assert.rejects(() => sql`INSERT INTO ec_posts(id) VALUES ('missing')`.execute(f.database.db));
    await f.service.createDraft({ type: 'posts', slug: 'same', data: { code: 'aa' } });
    await assert.rejects(() => f.service.createDraft({ type: 'posts', data: { code: 'aa' } }));
    await f.service.createDraft({ type: 'posts', slug: 'same', locale: 'fr', data: { code: 'bb' } });
    await assert.rejects(() => f.service.createDraft({ type: 'posts', slug: 'same', data: { code: 'cc' } }));
    await assert.rejects(() => sql`INSERT INTO _cms_fields(id, collection_id, slug, label, type, column_type, required, "unique", sort_order, created_at)
      VALUES ('orphan', 'missing', 'field', 'Field', 'text', 'TEXT', 0, 0, 0, 'now')`.execute(f.database.db));
  } finally { await f.database.close(); }
});

test('anonymous/empty principals and missing permissions fail closed before any query', async () => {
  const database = openSqlite(':memory:'); // Intentionally unmigrated; unauthorized calls must never touch storage.
  try {
    for (const principal of [null, { id: '', permissions: admin.permissions }] as const) {
      const service = cmsService(database, principal);
      for (const run of [() => service.listCollections(), () => service.getCollection('posts'), () => service.createCollection({}),
        () => service.addField({}), () => service.listDrafts({}), () => service.getDraft({}), () => service.createDraft({}),
        () => service.updateDraft({}), () => service.deleteDraft({})]) {
        await assert.rejects(run, { code: 'UNAUTHENTICATED' });
      }
    }
    const reader = cmsService(database, { id: 'subscriber', permissions: ['content:read'] });
    await assert.rejects(() => reader.listDrafts({ type: 'posts' }), { code: 'FORBIDDEN' });
    await assert.rejects(() => reader.getDraft({ type: 'posts', id: 'missing' }), { code: 'FORBIDDEN' });
    await assert.rejects(() => reader.createDraft({}), { code: 'FORBIDDEN' });
    await assert.rejects(() => reader.updateDraft({}), { code: 'FORBIDDEN' });
    await assert.rejects(() => reader.deleteDraft({}), { code: 'FORBIDDEN' });
    await assert.rejects(() => reader.createCollection({}), { code: 'FORBIDDEN' });
  } finally { await database.close(); }
});

test('owner permissions use persisted author; any permission permits another author', async () => {
  const f = await fixture();
  try {
    const author = cmsService(f.database, { id: 'author', permissions: ['content:create', 'content:edit_own', 'content:delete_own'] });
    const stranger = cmsService(f.database, { id: 'stranger', permissions: ['content:edit_own', 'content:delete_own'] });
    const created = await author.createDraft({ type: 'posts', data: { title: 'Owned', body: 'Preserved' } });
    assert.equal(created.authorId, 'author');
    await assert.rejects(() => stranger.updateDraft({ type: 'posts', id: created.id, expected: expected(created), data: { title: 'Stolen' } }), { code: 'FORBIDDEN' });
    await assert.rejects(() => stranger.deleteDraft({ type: 'posts', id: created.id, expected: expected(created) }), { code: 'FORBIDDEN' });
    const updated = await author.updateDraft({ type: 'posts', id: created.id, expected: expected(created), data: { title: 'Changed' } });
    assert.equal(updated.data.title, 'Changed'); assert.equal(updated.data.body, 'Preserved'); assert.equal(updated.version, 2);
    const edited = await f.service.updateDraft({ type: 'posts', id: created.id, expected: expected(updated), data: { title: 'Editor' } });
    assert.equal(edited.authorId, 'author');
  } finally { await f.database.close(); }
});

test('two independent connections competing from the same revision yield exactly one successful update', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'cms-conflict-')); const path = join(directory, 'db.sqlite');
  const first = await fixture(path); const second = openSqlite(path);
  try {
    const other = cmsService(second, admin);
    const created = await first.service.createDraft({ type: 'posts', data: { title: 'Initial', body: 'Preserved' } });
    const outcomes = await Promise.allSettled([
      first.service.updateDraft({ type: 'posts', id: created.id, expected: expected(created), data: { title: 'One' } }),
      other.updateDraft({ type: 'posts', id: created.id, expected: expected(created), data: { title: 'Two' } })
    ]);
    assert.equal(outcomes.filter(item => item.status === 'fulfilled').length, 1);
    const rejected = outcomes.find(item => item.status === 'rejected');
    assert.equal(rejected?.status, 'rejected'); assert.ok(rejected?.status === 'rejected' && conflict(rejected.reason));
    const current = await other.getDraft({ type: 'posts', id: created.id });
    assert.equal(current.version, 2); assert.equal(current.data.body, 'Preserved');
    await assert.rejects(() => other.deleteDraft({ type: 'posts', id: created.id, expected: expected(created) }), conflict);
    await other.deleteDraft({ type: 'posts', id: created.id, expected: expected(current) });
    await assert.rejects(() => first.service.getDraft({ type: 'posts', id: created.id }), { code: 'NOT_FOUND' });
    assert.equal((await first.service.listDrafts({ type: 'posts' })).items.length, 0);
    assert.equal((await sql<{ version: number }>`SELECT version FROM ec_posts WHERE id = ${created.id}`.execute(first.database.db)).rows[0].version, 3);
  } finally { await second.close(); await first.database.close(); rmSync(directory, { recursive: true, force: true }); }
});

test('schema version conflicts and field bounds preserve existing definitions', async () => {
  const f = await fixture();
  try {
    const version = (await f.schema.getCollection('posts'))!.version;
    await f.service.addField({ collection: 'posts', expectedSchemaVersion: version, input: { slug: 'new_field', label: 'New', type: 'text' } });
    await assert.rejects(() => f.service.addField({ collection: 'posts', expectedSchemaVersion: version, input: { slug: 'stale', label: 'Stale', type: 'text' } }), conflict);
    assert.equal(await f.schema.getField('posts', 'stale'), null);
    for (let n = 3; n < MAX_FIELDS; n++) await f.schema.createField('posts', { slug: 'f_' + n, label: 'Field', type: 'text' });
    await assert.rejects(() => f.schema.createField('posts', { slug: 'overflow', label: 'Overflow', type: 'text' }), { code: 'LIMIT_EXCEEDED' });
    assert.equal((await f.schema.listFields((await f.schema.getCollection('posts'))!.id)).length, MAX_FIELDS);
    await assert.rejects(() => f.service.addField({ collection: 'posts', input: { slug: 'missing_version', label: 'Missing', type: 'text' } }), invalid);
  } finally { await f.database.close(); }
});

test('summary query excludes large bodies, clamps pages, orders ties, scopes locales and validates cursors', async () => {
  const f = await fixture();
  try {
    for (let i = 0; i < 103; i++) await f.service.createDraft({ type: 'posts', data: { title: 'Title ' + i, body: 'b'.repeat(100_000) } });
    await f.service.createDraft({ type: 'posts', locale: 'fr', data: { title: 'French' } });
    await sql`UPDATE ec_posts SET created_at = '2026-01-01T00:00:00.000Z'`.execute(f.database.db);
    const first = await f.service.listDrafts({ type: 'posts', limit: 1000 });
    assert.equal(first.items.length, 100); assert.ok(first.nextCursor);
    assert.equal('data' in first.items[0], false);
    assert.equal(JSON.stringify(first).includes('bbbbbbbb'), false);
    const last = await f.service.listDrafts({ type: 'posts', cursor: first.nextCursor });
    assert.equal(last.items.length, 3); assert.equal(last.nextCursor, undefined);
    assert.equal(new Set([...first.items, ...last.items].map(item => item.id)).size, 103);
    assert.equal((await f.service.listDrafts({ type: 'posts', locale: 'fr' })).items.length, 1);
    assert.equal((await f.service.listDrafts({ type: 'posts' })).items.length, 50);
    for (const cursor of ['invalid', 'a'.repeat(2049), btoa('{}'), btoa(JSON.stringify({ type: 'posts', locale: 'fr', createdAt: '2026-01-01T00:00:00.000Z', id: 'a' }))]) {
      await assert.rejects(() => f.service.listDrafts({ type: 'posts', cursor }), invalid);
    }
  } finally { await f.database.close(); }
});

test('unique-index identity is unambiguous across collection/field underscores', async () => {
  const database = openSqlite(':memory:');
  try {
    await migrateCms(database); const registry = new SchemaRegistry(database);
    await registry.createCollection({ slug: 'foo_bar', label: 'First' });
    await registry.createCollection({ slug: 'foo', label: 'Second' });
    await registry.createField('foo_bar', { slug: 'baz', label: 'Unique', type: 'string', unique: true });
    await registry.createField('foo', { slug: 'bar_baz', label: 'Unique', type: 'string', unique: true });
    const repository = new DraftRepository(database);
    await repository.create({ type: 'foo_bar', data: { baz: 'value' } }, 'author');
    await repository.create({ type: 'foo', data: { bar_baz: 'value' } }, 'author');
    await assert.rejects(() => repository.create({ type: 'foo', data: { bar_baz: 'value' } }, 'author'));
  } finally { await database.close(); }
});

test('field length semantics preserve upstream JavaScript UTF-16 units for emoji and embedded NUL', async () => {
  const f = await fixture();
  try {
    await f.schema.createField('posts', { slug: 'utf16', label: 'UTF16', type: 'text', validation: { minLength: 2, maxLength: 2 } });
    const created = await f.service.createDraft({ type: 'posts', data: { utf16: '😀' } });
    assert.equal(created.data.utf16, '😀');
    const withNul = await f.service.createDraft({ type: 'posts', data: { utf16: 'a\0' } });
    assert.equal(withNul.data.utf16, 'a\0');
    await assert.rejects(() => f.service.createDraft({ type: 'posts', data: { utf16: 'x' } }), invalid);
    await assert.rejects(() => f.service.createDraft({ type: 'posts', data: { utf16: '😀x' } }), invalid);
  } finally { await f.database.close(); }
});

test('migrations reject unknown versions and unmanaged system tables without mutation', async () => {
  const database = openSqlite(':memory:');
  try {
    await sql`CREATE TABLE _cms_collections (sentinel TEXT)`.execute(database.db);
    await assert.rejects(() => migrateCms(database), { code: 'MIGRATION_REQUIRED' });
    assert.equal((await sql`SELECT name FROM sqlite_master WHERE name = '_cms_migrations'`.execute(database.db)).rows.length, 0);
  } finally { await database.close(); }
  const future = openSqlite(':memory:');
  try {
    await sql`CREATE TABLE _cms_migrations (version INTEGER)`.execute(future.db);
    await sql`INSERT INTO _cms_migrations VALUES (2)`.execute(future.db);
    await assert.rejects(() => migrateCms(future), { code: 'MIGRATION_REQUIRED' });
    assert.equal((await sql<{ version: number }>`SELECT version FROM _cms_migrations`.execute(future.db)).rows[0].version, 2);
  } finally { await future.close(); }
});

test('schema defaults reject NUL before DDL while escaped quotes remain inert', async () => {
  const f = await fixture();
  try {
    const before = (await f.schema.getCollection('posts'))!.version;
    await assert.rejects(() => f.schema.createField('posts', { slug: 'nul_default', label: 'Nul', type: 'text', defaultValue: 'a\0' }), invalid);
    assert.equal(await f.schema.getField('posts', 'nul_default'), null);
    assert.equal((await f.schema.getCollection('posts'))!.version, before);
    const quoted = "'; DROP TABLE _cms_collections; --";
    await f.schema.createField('posts', { slug: 'quoted_default', label: 'Quote', type: 'text', defaultValue: quoted });
    const entry = await f.service.createDraft({ type: 'posts', data: { title: 'Default' } });
    assert.equal(entry.data.quoted_default, quoted);
    assert.equal((await f.schema.listCollections()).length, 1);
  } finally { await f.database.close(); }
});

test('cursor OR branches keep locale and trash filters when titles and slugs are null', async () => {
  const f = await fixture();
  try {
    const kept = [
      await f.service.createDraft({ type: 'posts', data: {} }),
      await f.service.createDraft({ type: 'posts', data: { title: null } }),
      await f.service.createDraft({ type: 'posts', data: { title: 'Older' } })
    ];
    const hidden = [
      await f.service.createDraft({ type: 'posts', locale: 'fr', data: {} }),
      await f.service.createDraft({ type: 'posts', locale: 'fr', data: {} }),
      await f.service.createDraft({ type: 'posts', data: {} }),
      await f.service.createDraft({ type: 'posts', data: {} })
    ];
    await f.service.deleteDraft({ type: 'posts', id: hidden[2].id, expected: expected(hidden[2]) });
    await f.service.deleteDraft({ type: 'posts', id: hidden[3].id, expected: expected(hidden[3]) });
    // Keep tied hidden IDs below either visible cursor, so an ungrouped OR would leak them.
    const fixtureIds = [
      '00000000000000000000000010', '00000000000000000000000020', '00000000000000000000000030',
      '00000000000000000000000001', '00000000000000000000000002',
      '00000000000000000000000003', '00000000000000000000000004'
    ];
    const allRows = [...kept, ...hidden];
    for (let index = 0; index < allRows.length; index++) {
      const row = allRows[index];
      await sql`UPDATE ec_posts SET id = ${fixtureIds[index]}, translation_group = ${fixtureIds[index]} WHERE id = ${row.id}`.execute(f.database.db);
      row.id = fixtureIds[index];
    }
    const tied = '2026-02-01T00:00:00.000Z';
    const older = '2026-01-01T00:00:00.000Z';
    for (const row of [kept[0], kept[1], hidden[0], hidden[2]]) {
      await sql`UPDATE ec_posts SET created_at = ${tied} WHERE id = ${row.id}`.execute(f.database.db);
    }
    for (const row of [kept[2], hidden[1], hidden[3]]) {
      await sql`UPDATE ec_posts SET created_at = ${older} WHERE id = ${row.id}`.execute(f.database.db);
    }
    const seen: string[] = [];
    let cursor: string | undefined;
    for (let pageNumber = 0; pageNumber < 3; pageNumber++) {
      const page = await f.service.listDrafts({ type: 'posts', limit: 1, ...(cursor ? { cursor } : {}) });
      assert.equal(page.items.length, 1);
      const row = page.items[0];
      assert.equal(row.locale, 'en'); assert.equal(row.status, 'draft'); assert.equal(row.slug, null);
      assert.equal(row.title, row.id === kept[2].id ? 'Older' : null);
      seen.push(row.id); cursor = page.nextCursor;
      assert.equal(cursor !== undefined, pageNumber < 2);
    }
    assert.deepEqual(seen, [kept[0].id, kept[1].id].sort().reverse().concat(kept[2].id));
    assert.equal(new Set(seen).size, 3);
  } finally { await f.database.close(); }
});

test('concurrent same-slug collection creation reports a sanitized conflict and preserves unrelated failures', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'cms-schema-race-')); const path = join(directory, 'db.sqlite');
  const first = await fixture(path); const second = openSqlite(path);
  try {
    const other = cmsService(second, admin);
    const outcomes = await Promise.allSettled([
      first.service.createCollection({ slug: 'race', label: 'Race' }),
      other.createCollection({ slug: 'race', label: 'Race' })
    ]);
    assert.equal(outcomes.filter(result => result.status === 'fulfilled').length, 1);
    const rejected = outcomes.find(result => result.status === 'rejected');
    assert.ok(rejected?.status === 'rejected' && rejected.reason instanceof CmsError);
    assert.equal(rejected.reason.code, 'COLLECTION_EXISTS');
    assert.equal(rejected.reason.message, 'COLLECTION_EXISTS');
    const rows = await sql<{ count: number }>`SELECT count(*) AS count FROM _cms_collections WHERE slug = 'race'`.execute(first.database.db);
    assert.equal(rows.rows[0].count, 1);
    assert.equal((await sql`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'ec_race'`.execute(first.database.db)).rows.length, 1);
    assert.equal((await sql`SELECT * FROM _cms_guards`.execute(first.database.db)).rows.length, 0);
    const entry = await first.service.createDraft({ type: 'race', data: {} });
    assert.equal((await other.getDraft({ type: 'race', id: entry.id })).id, entry.id);
    await sql`CREATE TRIGGER reject_unrelated_collection BEFORE INSERT ON _cms_collections
      WHEN NEW.slug = 'unrelated' BEGIN SELECT RAISE(ABORT, 'unrelated schema failure'); END`.execute(first.database.db);
    await assert.rejects(() => first.service.createCollection({ slug: 'unrelated', label: 'Failure' }),
      cause => cause instanceof Error && !(cause instanceof CmsError) && cause.message === 'unrelated schema failure');
    assert.equal(await first.schema.getCollection('unrelated'), null);
    assert.equal((await sql`SELECT * FROM _cms_guards`.execute(first.database.db)).rows.length, 0);
  } finally { await second.close(); await first.database.close(); rmSync(directory, { recursive: true, force: true }); }
});

test('version-one migration markers reject missing system tables without repair or mutation', async () => {
  for (const missing of [null, '_cms_collections', '_cms_fields', '_cms_guards']) {
    const database = openSqlite(':memory:');
    try {
      if (missing === null) {
        await sql`CREATE TABLE _cms_migrations (version INTEGER PRIMARY KEY)`.execute(database.db);
        await sql`INSERT INTO _cms_migrations(version) VALUES (1)`.execute(database.db);
      } else {
        await migrateCms(database);
        await sql`DROP TABLE ${sql.ref(missing)}`.execute(database.db);
      }
      const before = (await sql<{ name: string }>`SELECT name FROM sqlite_master ORDER BY name`.execute(database.db)).rows;
      await assert.rejects(() => migrateCms(database), { code: 'MIGRATION_REQUIRED' });
      assert.deepEqual((await sql<{ name: string }>`SELECT name FROM sqlite_master ORDER BY name`.execute(database.db)).rows, before);
      assert.equal((await sql<{ version: number }>`SELECT version FROM _cms_migrations`.execute(database.db)).rows[0].version, 1);
    } finally { await database.close(); }
  }
});

test('same-slug creation at the collection cap still reports duplicate while new slugs report the bound', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'cms-schema-cap-race-')); const path = join(directory, 'db.sqlite');
  const first = await fixture(path); const second = openSqlite(path);
  try {
    for (let index = 1; index < MAX_COLLECTIONS - 1; index++) {
      await first.service.createCollection({ slug: 'existing_' + index, label: 'Existing' });
    }
    const other = cmsService(second, admin);
    const outcomes = await Promise.allSettled([
      first.service.createCollection({ slug: 'last_slot', label: 'Last' }),
      other.createCollection({ slug: 'last_slot', label: 'Last' })
    ]);
    assert.equal(outcomes.filter(result => result.status === 'fulfilled').length, 1);
    const rejected = outcomes.find(result => result.status === 'rejected');
    assert.ok(rejected?.status === 'rejected' && rejected.reason instanceof CmsError);
    assert.equal(rejected.reason.code, 'COLLECTION_EXISTS');
    assert.equal((await first.service.listCollections()).length, MAX_COLLECTIONS);
    await assert.rejects(() => first.service.createCollection({ slug: 'overflow', label: 'Overflow' }), { code: 'LIMIT_EXCEEDED' });
    assert.equal(await first.schema.getCollection('overflow'), null);
    assert.equal((await sql`SELECT name FROM sqlite_master WHERE name = 'ec_overflow'`.execute(first.database.db)).rows.length, 0);
    assert.equal((await sql`SELECT * FROM _cms_guards`.execute(first.database.db)).rows.length, 0);
  } finally { await second.close(); await first.database.close(); rmSync(directory, { recursive: true, force: true }); }
});
