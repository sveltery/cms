// Original supplemental fidelity probes; no upstream declaration credit.
// Authority: EmDash 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e,
// handlers/validation.ts:199 and schema/zod-generator.ts:41.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sql } from 'kysely';
import type { CmsDatabase, DraftEntry } from '../src/lib/server/database/contract.ts';
import { SchemaRegistry } from '../src/lib/server/database/registry.ts';
import { migrateCms } from '../src/lib/server/database/migrations.ts';
import { cmsService } from '../src/lib/server/database/service.ts';
import { schemaAdminStorage } from './helpers/schema-admin-storage.ts';

const admin = { id: 'admin', permissions: ['schema:manage', 'content:create', 'content:read', 'content:read_drafts', 'content:edit_any', 'content:delete_any'] } as const;
const expected = (entry: DraftEntry) => ({ version: entry.version, updatedAt: entry.updatedAt });

function monitored(database: CmsDatabase) {
  const writes: string[] = [];
  const db = database.db.withPlugin({
    transformQuery({ node }) {
      if (['InsertQueryNode', 'UpdateQueryNode', 'DeleteQueryNode', 'CreateTableNode', 'AlterTableNode', 'CreateIndexNode', 'DropTableNode', 'DropIndexNode'].includes(node.kind)) writes.push(node.kind);
      if (node.kind === 'RawNode' && 'sqlFragments' in node) {
        const text = (node.sqlFragments as readonly string[]).join(' ');
        if (/^\s*(INSERT|UPDATE|DELETE|REPLACE|CREATE|ALTER|DROP)\b/i.test(text)) writes.push(text);
      }
      return node;
    },
    async transformResult({ result }) { return result; }
  });
  return { writes, database: { db, close: () => database.close(), async atomicBatch(statements) {
    writes.push('atomicBatch');
    return database.atomicBatch(statements);
  } } satisfies CmsDatabase };
}

async function snapshot(database: CmsDatabase) {
  const db = database.db;
  const objects = (await sql<{ name: string; type: string; sql: string | null }>`SELECT name, type, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY name`.execute(db)).rows;
  const tables = [];
  for (const object of objects.filter(object => object.type === 'table' && (object.name.startsWith('_cms_') || object.name.startsWith('ec_')))) {
    tables.push({ name: object.name, rows: (await sql`SELECT * FROM ${sql.ref(object.name)} ORDER BY rowid`.execute(db)).rows });
  }
  return { objects, tables };
}

for (const target of ['Node', 'D1'] as const) {
  test(target + ': required/optional string/text defaults and cleared bounds preserve exact submitted/omitted validation', { timeout: 60000 }, async () => {
    const h = await schemaAdminStorage(target);
    try {
      await migrateCms(h.database);
      const registry = new SchemaRegistry(h.database);
      const watch = monitored(h.database);
      const service = cmsService(watch.database, admin);
      let index = 0;
      for (const type of ['string', 'text'] as const) for (const required of [false, true]) for (const defaultValue of [undefined, 'fallback', '']) {
        const collection = 'validation_' + index++;
        await registry.createCollection({ slug: collection, label: 'Validation' });
        await registry.createField(collection, { slug: 'value', label: 'Value', type, required,
          ...(defaultValue === undefined ? {} : { defaultValue }) });
        await registry.createField(collection, { slug: 'other', label: 'Other', type: 'string' });
        let current = await service.createDraft({ type: collection, data: { value: 'saved' } });
        async function rejected(operation: () => Promise<unknown>, code = 'VALIDATION_ERROR') {
          const before = await snapshot(h.database);
          watch.writes.length = 0;
          await assert.rejects(operation, { code });
          if (code !== 'CONFLICT') assert.deepEqual(watch.writes, [], 'rejected input must not attempt SQL writes or atomic batches');
          assert.deepEqual(await snapshot(h.database), before, 'all rows, metadata, tokens, DDL and indexes remain unchanged');
        }
        // Absent bounds, explicit zero, then populated bounds cleared to null/{}.
        for (const bounds of [undefined, { minLength: 0 }, null, {}]) {
          if (bounds !== undefined) {
            if (bounds === null || !Object.keys(bounds).length) await registry.updateField(collection, 'value', { validation: { minLength: 2, maxLength: 8 } });
            await registry.updateField(collection, 'value', { validation: bounds });
          }
          for (const value of ['', null, ' \t\n']) {
            const create = () => service.createDraft({ type: collection, data: { value } });
            const update = () => service.updateDraft({ type: collection, id: current.id, expected: expected(current), data: { value } });
            if (required && (value === '' || value === null)) {
              await rejected(create); await rejected(update);
            } else {
              const created = await create();
              assert.equal(created.data.value, value, 'preserve whitespace/empty/null without coercion or trimming');
              current = await update(); assert.equal(current.data.value, value);
            }
          }
          if (required && defaultValue === undefined) await rejected(() => service.createDraft({ type: collection, data: {} }));
          else {
            const omitted = await service.createDraft({ type: collection, data: {} });
            assert.equal(omitted.data.value, required ? defaultValue : null, 'raw physical omission semantics remain unchanged');
          }
          const beforeEmptyPatch = current;
          current = await service.updateDraft({ type: collection, id: current.id, expected: expected(current), data: {} });
          assert.deepEqual(current.data, beforeEmptyPatch.data);
          assert.equal(current.version, beforeEmptyPatch.version + 1);
          current = await service.updateDraft({ type: collection, id: current.id, expected: expected(current), data: { other: 'changed' } });
          assert.equal(current.data.value, beforeEmptyPatch.data.value);
        }
        await rejected(() => cmsService(watch.database, null).createDraft({ type: collection, data: { value: '' } }), 'UNAUTHENTICATED');
        await rejected(() => cmsService(watch.database, { id: 'reader', permissions: ['content:read'] }).createDraft({ type: collection, data: { value: '' } }), 'FORBIDDEN');
        await rejected(() => cmsService(watch.database, { id: 'other', permissions: ['content:edit_own'] }).updateDraft({ type: collection, id: current.id, expected: expected(current), data: { value: '' } }), 'FORBIDDEN');
        await rejected(() => service.updateDraft({ type: collection, id: current.id, expected: { ...expected(current), version: current.version - 1 }, data: { value: 'valid' } }), 'CONFLICT');
      }
    } finally { await h.close(); }
  });

  test(target + ': legacy required empty/null values remain readable and untouched by omitted patches, trash, restore and reopen', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'cms-required-legacy-'));
    let h = await schemaAdminStorage(target, directory);
    try {
      await migrateCms(h.database);
      const registry = new SchemaRegistry(h.database);
      await registry.createCollection({ slug: 'legacy', label: 'Legacy' });
      const setup = cmsService(h.database, admin);
      // Nullable legacy physical columns predate required metadata. No live DDL.
      for (const type of ['string', 'text'] as const) await registry.createField('legacy', { slug: type + '_value', label: type, type });
      await registry.createField('legacy', { slug: 'other', label: 'Other', type: 'string' });
      const entries = [];
      for (const value of ['', null]) entries.push(await setup.createDraft({ type: 'legacy', data: { string_value: value, text_value: value } }));
      await sql`UPDATE _cms_fields SET required = 1 WHERE slug IN ('string_value', 'text_value')`.execute(h.database.db);
      for (const saved of entries) {
        let current = await setup.getDraft({ type: 'legacy', id: saved.id });
        assert.deepEqual(current.data, saved.data);
        const watch = monitored(h.database);
        const service = cmsService(watch.database, admin);
        const unchanged = await snapshot(h.database);
        for (const field of ['string_value', 'text_value']) for (const value of ['', null]) {
          await assert.rejects(() => service.updateDraft({ type: 'legacy', id: saved.id, expected: expected(current), data: { [field]: value } }), { code: 'VALIDATION_ERROR' });
        }
        assert.deepEqual(watch.writes, []);
        assert.deepEqual(await snapshot(h.database), unchanged);
        current = await setup.updateDraft({ type: 'legacy', id: saved.id, expected: expected(current), data: {} });
        assert.deepEqual(current.data, saved.data);
        current = await setup.updateDraft({ type: 'legacy', id: saved.id, expected: expected(current), data: { other: 'changed' } });
        assert.equal(current.data.string_value, saved.data.string_value);
        assert.equal(current.data.text_value, saved.data.text_value);
        await setup.deleteDraft({ type: 'legacy', id: saved.id, expected: expected(current) });
        const trashed = await setup.getTrashedDraft({ type: 'legacy', id: saved.id });
        assert.deepEqual(trashed.data, current.data);
        const restored = await setup.restoreDraft({ type: 'legacy', id: saved.id, expected: expected(trashed) });
        assert.deepEqual(restored.data, current.data);
      }
      const before = await snapshot(h.database);
      await h.close(); h = await schemaAdminStorage(target, directory);
      assert.deepEqual(await snapshot(h.database), before);
      const reopened = cmsService(h.database, admin);
      for (const saved of entries) {
        const entry = await reopened.getDraft({ type: 'legacy', id: saved.id });
        assert.equal(entry.data.string_value, saved.data.string_value);
        assert.equal(entry.data.text_value, saved.data.text_value);
      }
    } finally { await h.close(); await rm(directory, { recursive: true, force: true }); }
  });
}
