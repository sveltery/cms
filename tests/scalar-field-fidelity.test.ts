import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sql } from 'kysely';
import { SchemaRegistry } from '../src/lib/server/database/registry.ts';
import { migrateCms } from '../src/lib/server/database/migrations.ts';
import { cmsService } from '../src/lib/server/database/service.ts';
import { schemaAdminStorage } from './helpers/schema-admin-storage.ts';
import { scalarMatrix, scalarSnapshot } from './helpers/scalar-field-contract.ts';

const admin = { id: 'admin', permissions: ['schema:manage', 'content:create', 'content:read', 'content:read_drafts', 'content:edit_any'] } as const;
for (const target of ['Node', 'D1'] as const) {
  test(target + ': 24 paired scalar DDL/metadata/omission/NULL/duplicate cases survive restart', { timeout: 60000 }, async () => {
    const directory = await mkdtemp(join(tmpdir(), 'cms-scalar-'));
    let h = await schemaAdminStorage(target, directory);
    try {
      await migrateCms(h.database);
      const registry = new SchemaRegistry(h.database);
      const service = cmsService(h.database, admin);
      await scalarMatrix(h.database.db, registry, async (type, data, partial) => {
        try {
        if (partial) {
          const entry = await service.createDraft({ type, data: { value: 'same' } });
          await service.updateDraft({ type, id: entry.id, expected: { version: entry.version, updatedAt: entry.updatedAt }, data });
        } else await service.createDraft({ type, data });
        return { ok: true };
        } catch (cause) {
          if (cause instanceof Error && 'code' in cause && cause.code === 'VALIDATION_ERROR') return { ok: false };
          throw cause;
        }
      }, true);
      const before = await scalarSnapshot(h.database.db, registry);
      await h.close();
      h = await schemaAdminStorage(target, directory);
      assert.deepEqual(await scalarSnapshot(h.database.db, new SchemaRegistry(h.database)), before);
    } finally { await h.close(); await rm(directory, { recursive: true, force: true }); }
  });

  test(target + ': opening a legacy table preserves divergent defaults/indexes and stored values', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'cms-legacy-scalar-'));
    let h = await schemaAdminStorage(target, directory);
    try {
      await migrateCms(h.database);
      const registry = new SchemaRegistry(h.database);
      await registry.createCollection({ slug: 'legacy', label: 'Legacy' });
      // Recreate baseline physical columns in a disposable fixture. The repair
      // must not rebuild these columns, remove indexes, or rewrite their data.
      await sql`ALTER TABLE ec_legacy ADD COLUMN optional_value TEXT DEFAULT 'old'`.execute(h.database.db);
      await sql`ALTER TABLE ec_legacy ADD COLUMN required_value TEXT NOT NULL`.execute(h.database.db);
      await sql`CREATE UNIQUE INDEX legacy_unique ON ec_legacy(required_value)`.execute(h.database.db);
      await sql`INSERT INTO ec_legacy(id, optional_value, required_value) VALUES ('saved', NULL, 'stored')`.execute(h.database.db);
      const snapshot = async () => ({
        columns: (await sql`PRAGMA table_info(ec_legacy)`.execute(h.database.db)).rows,
        indexes: (await sql`SELECT name, sql FROM sqlite_master WHERE tbl_name = 'ec_legacy' AND type = 'index' ORDER BY name`.execute(h.database.db)).rows,
        rows: (await sql`SELECT * FROM ec_legacy ORDER BY id`.execute(h.database.db)).rows
      });
      const before = await snapshot();
      await h.close(); h = await schemaAdminStorage(target, directory);
      assert.deepEqual(await snapshot(), before);
      await assert.rejects(() => sql`INSERT INTO ec_legacy(id, required_value) VALUES ('duplicate', 'stored')`.execute(h.database.db));
      await assert.rejects(() => sql`INSERT INTO ec_legacy(id) VALUES ('missing')`.execute(h.database.db));
      await sql`INSERT INTO ec_legacy(id, required_value) VALUES ('new', 'different')`.execute(h.database.db);
      assert.equal((await sql<{ optional_value: string }>`SELECT optional_value FROM ec_legacy WHERE id = 'new'`.execute(h.database.db)).rows[0].optional_value, 'old');
    } finally { await h.close(); await rm(directory, { recursive: true, force: true }); }
  });

  test(target + ': authorized future fields retain stale/racing schema CAS and independent DDL rollback', async () => {
    const h = await schemaAdminStorage(target);
    try {
      await migrateCms(h.database);
      const registry = new SchemaRegistry(h.database);
      await registry.createCollection({ slug: 'posts', label: 'Posts' });
      const service = cmsService(h.database, admin);
      const input = { slug: 'value', label: 'Value', type: 'text', required: true, unique: true };
      await assert.rejects(() => cmsService(h.database, null).addField({ collection: 'posts', expectedSchemaVersion: 1, input }), { code: 'UNAUTHENTICATED' });
      await assert.rejects(() => cmsService(h.database, { id: 'reader', permissions: ['schema:read'] }).addField({ collection: 'posts', expectedSchemaVersion: 1, input }), { code: 'FORBIDDEN' });
      assert.deepEqual((await sql`PRAGMA table_info(ec_posts)`.execute(h.database.db)).rows.filter(row => (row as { name: string }).name === 'value'), []);
      await sql`INSERT INTO ec_posts (id) VALUES ('before')`.execute(h.database.db);
      await service.addField({ collection: 'posts', expectedSchemaVersion: 1, input });
      assert.equal((await registry.getCollection('posts'))!.version, 2);
      const objects = () => sql`SELECT name, sql FROM sqlite_master ORDER BY name`.execute(h.database.db).then(r => r.rows);
      const before = await objects();
      await assert.rejects(() => service.addField({ collection: 'posts', expectedSchemaVersion: 1, input: { ...input, slug: 'stale' } }), { code: 'CONFLICT' });
      assert.deepEqual(await objects(), before);
      const outcomes = await Promise.allSettled(['first', 'second'].map(slug => service.addField({ collection: 'posts', expectedSchemaVersion: 2, input: { ...input, slug } })));
      assert.equal(outcomes.filter(outcome => outcome.status === 'fulfilled').length, 1);
      assert.equal(outcomes.filter(outcome => outcome.status === 'rejected' && outcome.reason.code === 'CONFLICT').length, 1);
      assert.equal((await registry.getCollection('posts'))!.version, 3);
      assert.equal((await registry.getCollectionWithFields('posts'))!.fields.length, 2);
      // Fail after ALTER TABLE without depending on the default/unique behavior
      // being repaired. A pre-existing unregistered column forces a DDL error.
      await sql`ALTER TABLE ec_posts ADD COLUMN collision TEXT`.execute(h.database.db);
      const collectionBefore = await registry.getCollectionWithFields('posts');
      const ddlBefore = await objects();
      await assert.rejects(() => service.addField({ collection: 'posts', expectedSchemaVersion: 3, input: { ...input, slug: 'collision' } }));
      assert.deepEqual(await registry.getCollectionWithFields('posts'), collectionBefore);
      assert.deepEqual(await objects(), ddlBefore);
      await assert.rejects(() => h.database.atomicBatch([
        sql`ALTER TABLE ec_posts ADD COLUMN rolled_back TEXT`.compile(h.database.db),
        sql`UPDATE ec_posts SET value = 'changed'`.compile(h.database.db),
        sql`INSERT INTO ec_posts(id) VALUES ('before')`.compile(h.database.db)
      ]));
      assert.deepEqual(await objects(), ddlBefore);
      assert.equal((await sql<{ value: string }>`SELECT value FROM ec_posts WHERE id = 'before'`.execute(h.database.db)).rows[0].value, '');
      assert.deepEqual((await sql`SELECT * FROM _cms_guards`.execute(h.database.db)).rows, []);
    } finally { await h.close(); }
  });

  test(target + ': metadata defaults and unenforced uniqueness round-trip through content; required empty-string divergence stays explicit', async () => {
    const h = await schemaAdminStorage(target);
    try {
      await migrateCms(h.database);
      const registry = new SchemaRegistry(h.database);
      await registry.createCollection({ slug: 'posts', label: 'Posts' });
      await registry.createField('posts', { slug: 'required_value', label: 'Required', type: 'string', required: true, unique: true });
      await registry.createField('posts', { slug: 'optional_value', label: 'Optional', type: 'text', unique: true, defaultValue: "O'Brien" });
      const service = cmsService(h.database, admin);
      await assert.rejects(() => service.createDraft({ type: 'posts', data: {} }), { code: 'VALIDATION_ERROR' });
      await assert.rejects(() => service.createDraft({ type: 'posts', data: { required_value: null } }), { code: 'VALIDATION_ERROR' });
      const a = await service.createDraft({ type: 'posts', data: { required_value: 'same' } });
      const b = await service.createDraft({ type: 'posts', data: { required_value: 'same' } });
      assert.equal(a.data.optional_value, null); assert.equal(b.data.optional_value, null);
      assert.equal((await registry.getField('posts', 'optional_value'))!.defaultValue, "O'Brien");
      const updated = await service.updateDraft({ type: 'posts', id: b.id, expected: { version: b.version, updatedAt: b.updatedAt }, data: { required_value: 'same', optional_value: null } });
      assert.equal(updated.data.required_value, a.data.required_value); assert.equal(updated.data.optional_value, null);
      // Deliberately divergent assertion: pinned handlers reject required ''.
      const empty = await service.createDraft({ type: 'posts', data: { required_value: '' } });
      assert.equal(empty.data.required_value, '');
      assert.equal((await service.updateDraft({ type: 'posts', id: empty.id, expected: { version: empty.version, updatedAt: empty.updatedAt }, data: { required_value: '' } })).data.required_value, '');
    } finally { await h.close(); }
  });
}
