// Selected expectations from EmDash 1.1.0 at immutable
// 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e. Copyright 2026 Cloudflare Inc.
// MIT; see notices/emdash-MIT.txt and docs/field-edit-ports.json.
// registry.test.ts:668 is partial (widget omitted); MCP schema.test.ts:1003
// preserves both expressions with adapted fixture setup, not MCP transport.
// The :982 validation observations are supplemental and earn no source credit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'kysely';
import { SchemaRegistry } from '../src/lib/server/database/registry.ts';
import { cmsService, type ServerPrincipal } from '../src/lib/server/database/service.ts';
import { migrateCms } from '../src/lib/server/database/migrations.ts';
import { schemaAdminStorage } from './helpers/schema-admin-storage.ts';

const principal: ServerPrincipal = { id: 'field-edit-admin', permissions: [
  'schema:manage', 'schema:read', 'content:create', 'content:read', 'content:read_drafts', 'content:edit_any'
] };
for (const target of ['Node', 'D1'] as const) {
  async function fixture() {
    const storage = await schemaAdminStorage(target);
    try {
      await migrateCms(storage.database);
      const registry = new SchemaRegistry(storage.database);
      await registry.createCollection({ slug: 'posts', label: 'Posts' });
      await registry.createField('posts', { slug: 'title', label: 'Title', type: 'string' });
      await registry.createCollection({ slug: 'post', label: 'Posts' });
      await registry.createField('post', { slug: 'body', label: 'Body', type: 'text' });
      return { ...storage, registry, service: cmsService(storage.database, principal) };
    } catch (error) { await storage.close(); throw error; }
  }

  // Source ID: pin:packages/core/tests/unit/schema/registry.test.ts:668.
  // Source request widget:'text' and its assertion are omitted. Two of three
  // source expressions remain; this is not a complete source declaration.
  test(`${target}: partial registry.test.ts:668 existing-field label/order expectations`, { timeout: 30000 }, async () => {
    const f = await fixture();
    try {
      const updated = await f.registry.updateField('posts', 'title', { label: 'Post Title', sortOrder: 3 });
      assert.equal(updated.label, 'Post Title');
      assert.equal(updated.sortOrder, 3);
    } finally { await f.close(); }
  });

  // Source ID: pin:packages/core/tests/integration/mcp/schema.test.ts:1003.
  // The source itself calls registry.updateField directly despite its MCP suite
  // placement. Both exact expressions/input values remain; the test runner,
  // migrations, dialect fixture and initial collection/field setup are adapted.
  test(`${target}: adapted MCP schema.test.ts:1003 preserves concurrent partial field updates`, { timeout: 30000 }, async () => {
    const f = await fixture();
    try {
      await Promise.all([
        f.registry.updateField('post', 'body', { label: 'Summary' }),
        f.registry.updateField('post', 'body', { sortOrder: 7 })
      ]);
      const field = await f.registry.getField('post', 'body');
      assert.equal(field?.label, 'Summary');
      assert.equal(field?.sortOrder, 7);
    } finally { await f.close(); }
  });

  // Original supplemental dataset, paired with the complete immutable source
  // reproducer. Compares stored SQL cells rather than differing NULL projections.
  test(`${target}: supplemental paired 12-layout metadata-default change preserves raw/content omitted inserts`, { timeout: 30000 }, async () => {
    const f = await fixture();
    try {
      let index = 0;
      for (const type of ['string', 'text'] as const) for (const required of [false, true])
        for (const initial of [undefined, 'old SQL value', '']) {
          const slug = `probe_${index++}`; const table = `ec_${slug}`;
          await f.registry.createCollection({ slug, label: 'Probe' });
          await f.registry.createField(slug, { slug: 'value', label: 'Value', type, required,
            ...(initial === undefined ? {} : { defaultValue: initial }) });
          const collection = await f.registry.getCollection(slug);
          const physical = required ? initial ?? '' : null;
          await f.service.createDraft({ type: slug, slug: 'saved', data: { value: 'Stored content' } });
          await sql`INSERT INTO ${sql.ref(table)} (id) VALUES ('raw_before')`.execute(f.database.db);
          const cell = async (id: string) => (await sql<{ value: string | null }>`SELECT value FROM ${sql.ref(table)} WHERE id = ${id}`.execute(f.database.db)).rows[0].value;
          assert.equal(await cell('raw_before'), physical);
          // Full handler/service validation rejects a missing required field
          // without metadata default, although low-level raw storage uses ''.
          if (required && initial === undefined)
            await assert.rejects(() => f.service.createDraft({ type: slug, data: {} }), { code: 'VALIDATION_ERROR' });
          else {
            const prior = await f.service.createDraft({ type: slug, data: {} });
            assert.equal(await cell(prior.id), physical);
          }
          const ddl = async () => (await sql`SELECT name, sql FROM sqlite_master WHERE tbl_name = ${table} ORDER BY name`.execute(f.database.db)).rows;
          const rows = async () => (await sql`SELECT * FROM ${sql.ref(table)} ORDER BY id`.execute(f.database.db)).rows;
          const beforeDdl = await ddl(); const beforeRows = await rows();
          const edited = await f.service.updateField({ collection: slug, field: 'value',
            defaultValue: 'new metadata value', validation: { maxLength: 1 } });
          assert.equal(edited.defaultValue, 'new metadata value');
          assert.deepEqual(edited.validation, { maxLength: 1 });
          assert.deepEqual(await ddl(), beforeDdl); assert.deepEqual(await rows(), beforeRows);
          assert.deepEqual(await f.registry.getCollection(slug), collection);
          const omitted = await f.service.createDraft({ type: slug, data: {} });
          await sql`INSERT INTO ${sql.ref(table)} (id) VALUES ('raw_after')`.execute(f.database.db);
          assert.equal(await cell(omitted.id), physical); assert.equal(await cell('raw_after'), physical);
        }
      assert.equal(index, 12);
    } finally { await f.close(); }
  });

  // Inspired by :982 before/after validation observations. The local boundary
  // executes trusted CMS service writes rather than MCP/generated-Zod caches;
  // do not count any of :982's five expressions or its declaration as ported.
  test(`${target}: supplemental field-update validation observation applies to future writes and leaves old content readable`, { timeout: 30000 }, async () => {
    const f = await fixture();
    try {
      const before = await f.service.createDraft({ type: 'post', data: { body: 'primes the cache' } });
      const collection = await f.service.getCollection('post');
      const field = await f.service.updateField({ collection: 'post', field: 'body', validation: { maxLength: 1 } });
      assert.deepEqual(field.validation, { maxLength: 1 });
      await assert.rejects(() => f.service.createDraft({ type: 'post', data: { body: 'too long' } }), { code: 'VALIDATION_ERROR' });
      await assert.rejects(() => f.service.updateDraft({ type: 'post', id: before.id,
        expected: { version: before.version, updatedAt: before.updatedAt }, data: { body: 'too long' } }), { code: 'VALIDATION_ERROR' });
      assert.deepEqual(await f.service.getDraft({ type: 'post', id: before.id }), before);
      const valid = await f.service.createDraft({ type: 'post', data: { body: 'x' } });
      assert.equal(valid.data.body, 'x');
      const after = await f.service.getCollection('post');
      assert.equal(after.version, collection.version);
      assert.equal(after.updatedAt, collection.updatedAt);
    } finally { await f.close(); }
  });
}
