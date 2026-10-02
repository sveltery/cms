// Supplemental fidelity probes, not complete upstream test declarations.
// Authority: EmDash 1.1.0, immutable 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e,
// api/schemas/schema.ts:97, schema/zod-generator.ts:256 and handlers/validation.ts:199.
// Source behavior is independently reproduced by scripts/reproduce-pattern-validation-upstream.mjs.
// The all-fields.test.ts:58 port below preserves the two pattern assertions,
// with a persisted string/text fixture and asynchronous service boundary.
// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sql } from 'kysely';
import * as v from 'valibot';
import type { CmsDatabase, DraftEntry } from '../src/lib/server/database/contract.ts';
import { fieldInput } from '../src/lib/server/database/validation.ts';
import { fieldEditValidation } from '../src/lib/server/database/field-edit-validation.ts';
import { SchemaRegistry } from '../src/lib/server/database/registry.ts';
import { migrateCms } from '../src/lib/server/database/migrations.ts';
import { cmsService } from '../src/lib/server/database/service.ts';
import { editorManifest } from '../src/lib/server/content/manifest.ts';
import { schemaAdminStorage } from './helpers/schema-admin-storage.ts';

const admin = { id: 'pattern-admin', permissions: ['schema:manage', 'schema:read', 'content:create', 'content:read',
  'content:read_drafts', 'content:edit_any', 'content:delete_any'] } as const;
const expected = (entry: DraftEntry) => ({ version: entry.version, updatedAt: entry.updatedAt });

function monitored(database: CmsDatabase) {
  const writes: string[] = [];
  const db = database.db.withPlugin({
    transformQuery({ node }) {
      if (['InsertQueryNode', 'UpdateQueryNode', 'DeleteQueryNode', 'CreateTableNode', 'AlterTableNode', 'CreateIndexNode', 'DropTableNode', 'DropIndexNode'].includes(node.kind)) writes.push(node.kind);
      if (node.kind === 'RawNode' && 'sqlFragments' in node) {
        const source = (node.sqlFragments as readonly string[]).join(' ');
        if (/^\s*(INSERT|UPDATE|DELETE|REPLACE|CREATE|ALTER|DROP)\b/i.test(source)) writes.push(source);
      }
      return node;
    },
    async transformResult({ result }) { return result; }
  });
  return { writes, database: { db, close: () => database.close(), async atomicBatch(statements) {
    writes.push('atomicBatch'); return database.atomicBatch(statements);
  } } satisfies CmsDatabase };
}

async function snapshot(database: CmsDatabase) {
  const objects = (await sql<{ name: string; type: string; sql: string | null }>`SELECT name, type, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY name`.execute(database.db)).rows;
  const tables = await Promise.all(objects.filter(object => object.type === 'table' &&
    (object.name.startsWith('_cms_') || object.name.startsWith('ec_'))).map(async object => ({ name: object.name,
    rows: (await sql`SELECT * FROM ${sql.ref(object.name)} ORDER BY rowid`.execute(database.db)).rows })));
  return { objects, tables };
}

test('pattern metadata syntax is a string source, including empty, with a localized malformed-pattern issue', () => {
  for (const pattern of ['', ' ', 'ok', '^ok$', '/ok/i', '\\p{L}+', '\\0']) {
    assert.equal(v.safeParse(fieldInput, { slug: 'value', label: 'Value', type: 'string', validation: { pattern } }).success, true);
    assert.equal(v.safeParse(fieldEditValidation, { pattern }).success, true);
  }
  for (const pattern of ['[', '(', '*', '\\', null, 1, true, {}, []]) {
    const created = v.safeParse(fieldInput, { slug: 'value', label: 'Value', type: 'string', validation: { pattern } });
    const edited = v.safeParse(fieldEditValidation, { pattern });
    assert.equal(created.success, false); assert.equal(edited.success, false);
    if (typeof pattern === 'string') {
      assert.equal(created.issues?.some(issue => issue.message === 'Invalid validation pattern' &&
        issue.path?.map(item => item.key).join('.') === 'validation.pattern'), true);
      assert.equal(edited.issues?.some(issue => issue.message === 'Invalid validation pattern' &&
        issue.path?.map(item => item.key).join('.') === 'pattern'), true);
    }
  }
});

for (const target of ['Node', 'D1'] as const) {
  // Source ID: pin:packages/core/tests/unit/fields/all-fields.test.ts:58.
  // Source text({pattern:/^[A-Z]+$/}) factory becomes persisted scalar metadata;
  // standard doesNotReject/rejects replace synchronous not.toThrow/toThrow.
  // This adapts both observable assertions, not the static factory/URL/MCP APIs.
  for (const type of ['string', 'text'] as const) test(`${target}/${type}: adapted all-fields.test.ts:58 should enforce pattern`, async () => {
    const h = await schemaAdminStorage(target);
    try {
      await migrateCms(h.database);
      const registry = new SchemaRegistry(h.database);
      await registry.createCollection({ slug: 'posts', label: 'Posts' });
      await registry.createField('posts', { slug: 'value', label: 'Value', type });
      // Direct persisted setup isolates content enforcement for assertion-level
      // baseline red, independently from the missing pattern-creation capability.
      const UPPERCASE_PATTERN_REGEX = /^[A-Z]+$/;
      await sql`UPDATE _cms_fields SET validation = ${JSON.stringify({ pattern: UPPERCASE_PATTERN_REGEX.source })}
        WHERE slug = 'value'`.execute(h.database.db);
      const service = cmsService(h.database, admin);
      const field = { schema: { parse: (value: string) => service.createDraft({ type: 'posts', data: { value } }) } };
      await assert.doesNotReject(() => field.schema.parse('HELLO'));
      await assert.rejects(() => field.schema.parse('hello'));
    } finally { await h.close(); }
  });

  test(`${target}: pattern metadata persists, projects unchanged and replaces without changing content, defaults, DDL or tokens`, { timeout: 120000 }, async () => {
    const directory = await mkdtemp(join(tmpdir(), 'cms-pattern-metadata-'));
    let h = await schemaAdminStorage(target, directory);
    try {
      await migrateCms(h.database);
      const registry = new SchemaRegistry(h.database);
      await registry.createCollection({ slug: 'patterns', label: 'Patterns' });
      for (const type of ['string', 'text'] as const) await registry.createField('patterns', {
        slug: type, label: type, type, defaultValue: 'metadata fallback', validation: { pattern: '' }
      });
      const service = cmsService(h.database, admin);
      const saved = await service.createDraft({ type: 'patterns', data: { string: 'old value', text: 'old value' } });
      const before = await snapshot(h.database);
      for (const type of ['string', 'text'] as const) {
        let field = await registry.updateField('patterns', type, { validation: { minLength: 1, maxLength: 100, pattern: '^ok$' } });
        assert.deepEqual(field.validation, { minLength: 1, maxLength: 100, pattern: '^ok$' });
        assert.deepEqual((await editorManifest(h.database, admin)).collections.patterns.fields[type].validation, field.validation);
        assert.deepEqual((await registry.updateField('patterns', type, { label: 'Renamed', validation: undefined })).validation, field.validation);
        for (const validation of [{ pattern: ' ' }, { pattern: '/ok/i' }, { pattern: '' }, {}, null]) {
          field = await registry.updateField('patterns', type, { validation });
          assert.deepEqual(field.validation, validation);
          const projected = (await editorManifest(h.database, admin)).collections.patterns.fields[type];
          assert.equal(Object.hasOwn(projected, 'validation'), validation !== null);
          if (validation !== null) assert.deepEqual(projected.validation, validation);
        }
        field = await registry.updateField('patterns', type, { validation: { pattern: '^ok$' } });
        assert.deepEqual(field.validation, { pattern: '^ok$' }, 'replacement removes prior bounds');
      }
      const after = await snapshot(h.database);
      assert.deepEqual(after.objects, before.objects);
      assert.deepEqual(after.tables.filter(table => table.name !== '_cms_fields'), before.tables.filter(table => table.name !== '_cms_fields'));
      assert.deepEqual(await service.getDraft({ type: 'patterns', id: saved.id }), saved);
      await h.close(); h = await schemaAdminStorage(target, directory);
      assert.deepEqual(await snapshot(h.database), after);
      const reopened = await new SchemaRegistry(h.database).getCollectionWithFields('patterns');
      assert.deepEqual(reopened?.fields.map(field => field.validation), [{ pattern: '^ok$' }, { pattern: '^ok$' }]);
      assert.deepEqual(await cmsService(h.database, admin).getDraft({ type: 'patterns', id: saved.id }), saved);
    } finally { await h.close(); await rm(directory, { recursive: true, force: true }); }
  });

  test(`${target}: full/partial supplied string patterns preserve null, omission, metadata defaults and legacy other-field writes`, { timeout: 120000 }, async () => {
    const h = await schemaAdminStorage(target);
    try {
      await migrateCms(h.database);
      const registry = new SchemaRegistry(h.database);
      const watch = monitored(h.database);
      const service = cmsService(watch.database, admin);
      let index = 0;
      for (const type of ['string', 'text'] as const) for (const required of [false, true]) for (const defaultValue of [undefined, 'fallback', '']) {
        const collection = 'patterns_' + index++;
        await registry.createCollection({ slug: collection, label: 'Patterns' });
        await registry.createField(collection, { slug: 'value', label: 'Value', type, required,
          ...(defaultValue === undefined ? {} : { defaultValue }), validation: { pattern: '^ok$' } });
        await registry.createField(collection, { slug: 'other', label: 'Other', type: 'string' });
        let current = await service.createDraft({ type: collection, data: { value: 'ok' } });
        async function rejected(operation: () => Promise<unknown>) {
          const before = await snapshot(h.database); watch.writes.length = 0;
          await assert.rejects(operation, { code: 'VALIDATION_ERROR' });
          assert.deepEqual(watch.writes, [], 'invalid content attempts no SQL mutation or atomic batch');
          assert.deepEqual(await snapshot(h.database), before, 'rejection preserves rows, metadata, tokens, migrations, DDL and indexes');
        }
        for (const value of ['OK', 'prefix ok suffix', '', null, ' \t\n']) {
          const create = () => service.createDraft({ type: collection, data: { value } });
          const update = () => service.updateDraft({ type: collection, id: current.id, expected: expected(current), data: { value } });
          if (value === null && !required) {
            assert.equal((await create()).data.value, null);
            current = await update(); assert.equal(current.data.value, null);
          } else { await rejected(create); await rejected(update); }
        }
        if (required && defaultValue === undefined) await rejected(() => service.createDraft({ type: collection, data: {} }));
        else assert.equal((await service.createDraft({ type: collection, data: {} })).data.value, required ? defaultValue : null,
          'omitted default bypasses pattern validation without materializing a metadata default');
        // A tightened pattern does not revalidate stored legacy nonmatching content.
        await sql`UPDATE ${sql.ref('ec_' + collection)} SET value = 'legacy mismatch' WHERE id = ${current.id}`.execute(h.database.db);
        current = await service.getDraft({ type: collection, id: current.id });
        for (const data of [{}, { other: 'changed' }]) {
          const previous = current;
          current = await service.updateDraft({ type: collection, id: current.id, expected: expected(current), data });
          assert.equal(current.data.value, 'legacy mismatch'); assert.equal(current.version, previous.version + 1);
        }
        await service.deleteDraft({ type: collection, id: current.id, expected: expected(current) });
        const trashed = await service.getTrashedDraft({ type: collection, id: current.id });
        current = await service.restoreDraft({ type: collection, id: current.id, expected: expected(trashed) });
        assert.equal(current.data.value, 'legacy mismatch');
        await registry.updateField(collection, 'value', { validation: { pattern: '' } });
        if (required) await rejected(() => service.updateDraft({ type: collection, id: current.id, expected: expected(current), data: { value: '' } }));
        else current = await service.updateDraft({ type: collection, id: current.id, expected: expected(current), data: { value: '' } });
        current = await service.updateDraft({ type: collection, id: current.id, expected: expected(current), data: { value: 'any text' } });
        assert.equal(current.data.value, 'any text');
      }
    } finally { await h.close(); }
  });

  test(`${target}: pattern sources use JavaScript search semantics without trimming, implicit anchors or flags`, async () => {
    const h = await schemaAdminStorage(target);
    try {
      await migrateCms(h.database);
      const registry = new SchemaRegistry(h.database);
      await registry.createCollection({ slug: 'sources', label: 'Sources' });
      for (const type of ['string', 'text'] as const) await registry.createField('sources', { slug: type, label: type, type });
      const service = cmsService(h.database, admin);
      for (const { pattern, valid, invalid } of [
        { pattern: 'ok', valid: 'prefix ok suffix', invalid: 'OK' },
        { pattern: '/ok/i', valid: '/ok/i', invalid: 'OK' },
        { pattern: '^ \\t\\n$', valid: ' \t\n', invalid: 'ok' },
        { pattern: '^$', valid: '', invalid: 'ok' }
      ]) {
        for (const type of ['string', 'text'] as const) await registry.updateField('sources', type, { validation: { pattern } });
        const created = await service.createDraft({ type: 'sources', data: { string: valid, text: valid } });
        assert.deepEqual(created.data, { string: valid, text: valid });
        await assert.rejects(() => service.createDraft({ type: 'sources', data: { string: invalid, text: invalid } }), { code: 'VALIDATION_ERROR' });
      }
      await registry.updateField('sources', 'string', { validation: { minLength: 3, maxLength: 4, pattern: 'ok' } });
      for (const string of ['ok', 'okabc', 'bad']) await assert.rejects(() => service.createDraft({ type: 'sources', data: { string } }), { code: 'VALIDATION_ERROR' });
      assert.equal((await service.createDraft({ type: 'sources', data: { string: 'xok' } })).data.string, 'xok');
    } finally { await h.close(); }
  });

  test(`${target}: invalid schema requests write nothing; malformed legacy regex eagerly throws while read/projection/trash remain available`, async () => {
    const h = await schemaAdminStorage(target);
    try {
      await migrateCms(h.database);
      const setup = new SchemaRegistry(h.database);
      await setup.createCollection({ slug: 'legacy', label: 'Legacy' });
      for (const slug of ['value', 'other']) await setup.createField('legacy', { slug, label: slug, type: 'text' });
      const watch = monitored(h.database);
      const service = cmsService(watch.database, admin);
      const saved = await service.createDraft({ type: 'legacy', data: { value: 'old' } });
      for (const pattern of ['[', '(', '\\', null, false, 0, [], {}]) {
        const before = await snapshot(h.database); watch.writes.length = 0;
        await assert.rejects(() => service.addField({ collection: 'legacy', expectedSchemaVersion: 3,
          input: { slug: 'invalid', label: 'Invalid', type: 'string', validation: { pattern } } }), { code: 'VALIDATION_ERROR' });
        await assert.rejects(() => service.updateField({ collection: 'legacy', field: 'value', validation: { pattern } }), { code: 'VALIDATION_ERROR' });
        assert.deepEqual(watch.writes, []); assert.deepEqual(await snapshot(h.database), before);
      }
      await sql`UPDATE _cms_fields SET validation = ${JSON.stringify({ pattern: '[', internalNote: 'not projected' })} WHERE slug = 'value'`.execute(h.database.db);
      const before = await snapshot(h.database); watch.writes.length = 0;
      for (const data of [{}, { other: 'changed' }, { value: null }, { value: '' }, { value: 'old' }]) {
        await assert.rejects(() => service.createDraft({ type: 'legacy', data }), SyntaxError);
        await assert.rejects(() => service.updateDraft({ type: 'legacy', id: saved.id, expected: expected(saved), data }), SyntaxError);
      }
      assert.deepEqual(watch.writes, []); assert.deepEqual(await snapshot(h.database), before);
      assert.deepEqual(await service.getDraft({ type: 'legacy', id: saved.id }), saved);
      assert.deepEqual((await editorManifest(h.database, admin)).collections.legacy.fields.value.validation, { pattern: '[' });
      await assert.rejects(() => cmsService(watch.database, null).createDraft({ type: 'legacy', data: {} }), { code: 'UNAUTHENTICATED' });
      await assert.rejects(() => cmsService(watch.database, { id: 'reader', permissions: ['content:read'] }).createDraft({ type: 'legacy', data: {} }), { code: 'FORBIDDEN' });
      await service.deleteDraft({ type: 'legacy', id: saved.id, expected: expected(saved) });
      const trashed = await service.getTrashedDraft({ type: 'legacy', id: saved.id });
      assert.equal((await service.restoreDraft({ type: 'legacy', id: saved.id, expected: expected(trashed) })).data.value, 'old');
      await setup.updateField('legacy', 'value', { validation: null });
      assert.equal((await service.createDraft({ type: 'legacy', data: { value: 'repaired' } })).data.value, 'repaired');
    } finally { await h.close(); }
  });
}
