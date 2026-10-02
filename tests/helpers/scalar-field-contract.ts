// Original supplemental probes, shared unchanged by CMS and the complete pinned
// EmDash registry. No upstream test-declaration/assertion credit is claimed.
import assert from 'node:assert/strict';
import { sql } from 'kysely';
import type { CmsDatabase } from '../../src/lib/server/database/contract.ts';
import type { SchemaRegistry } from '../../src/lib/server/database/registry.ts';

export const scalarCases = ['string', 'text'].flatMap(type => [false, true].flatMap(required =>
  [undefined, "O'Brien", ''].flatMap(defaultValue => [false, true].map(unique => ({
    type: type as 'string' | 'text', required, unique,
    ...(defaultValue === undefined ? {} : { defaultValue })
  })))));

export async function scalarMatrix(db: CmsDatabase['db'], registry: SchemaRegistry,
  validate?: (collection: string, data: Record<string, string | null>, partial: boolean) => Promise<{ ok: boolean }>, requiredEmptyAllowed = false) {
  for (const [index, input] of scalarCases.entries()) {
    const slug = 'scalar_' + index;
    const table = 'ec_' + slug;
    await registry.createCollection({ slug, label: 'Scalar' });
    await sql`INSERT INTO ${sql.ref(table)} (id, slug) VALUES ('before', 'preserved')`.execute(db);
    const indexes = () => sql`SELECT name, sql FROM sqlite_master WHERE type = 'index' AND tbl_name = ${table} ORDER BY name`.execute(db).then(result => result.rows);
    const beforeIndexes = await indexes();
    const field = await registry.createField(slug, { slug: 'value', label: 'Value', ...input });
    assert.equal(field.required, input.required);
    assert.equal(field.unique, input.unique);
    assert.equal(field.defaultValue, input.defaultValue);
    // Compare stored metadata as well as the public projection: an implicit SQL
    // default must never turn into an explicit field default.
    const namespace = (await sql`SELECT name FROM sqlite_master WHERE name = '_cms_fields'`.execute(db)).rows.length ? '_cms_fields' : '_emdash_fields';
    const metadata = (await sql<{ default_value: string | null; unique: number }>`SELECT default_value, "unique" FROM ${sql.ref(namespace)} WHERE id = ${field.id}`.execute(db)).rows[0];
    assert.equal(metadata.default_value, input.defaultValue === undefined ? null : JSON.stringify(input.defaultValue));
    assert.equal(metadata.unique, Number(input.unique));
    const column = (await sql<{ name: string; notnull: number; dflt_value: string | null }>`PRAGMA table_info(${sql.ref(table)})`.execute(db)).rows.find(row => row.name === 'value');
    assert.ok(column);
    assert.equal(column.notnull, Number(input.required));
    const physicalDefault = input.required ? input.defaultValue ?? '' : null;
    assert.equal(column.dflt_value, physicalDefault === null ? null : "'" + physicalDefault.replaceAll("'", "''") + "'");
    assert.deepEqual(await indexes(), beforeIndexes);
    await sql`INSERT INTO ${sql.ref(table)} (id) VALUES ('omitted')`.execute(db);
    assert.deepEqual((await sql<{ id: string; value: string | null }>`SELECT id, value FROM ${sql.ref(table)} ORDER BY id`.execute(db)).rows.map(row => ({ ...row })),
      [{ id: 'before', value: physicalDefault }, { id: 'omitted', value: physicalDefault }]);
    assert.equal((await sql<{ slug: string }>`SELECT slug FROM ${sql.ref(table)} WHERE id = 'before'`.execute(db)).rows[0].slug, 'preserved');
    const insertNull = () => sql`INSERT INTO ${sql.ref(table)} (id, value) VALUES ('null', NULL)`.execute(db);
    if (input.required) await assert.rejects(insertNull);
    else {
      await insertNull();
      assert.equal((await sql<{ value: null }>`SELECT value FROM ${sql.ref(table)} WHERE id = 'null'`.execute(db)).rows[0].value, null);
    }
    await sql`INSERT INTO ${sql.ref(table)} (id, value) VALUES ('duplicate_a', 'same'), ('duplicate_b', 'same')`.execute(db);
    assert.equal((await sql<{ total: number }>`SELECT COUNT(*) AS total FROM ${sql.ref(table)} WHERE value = 'same'`.execute(db)).rows[0].total, 2);
    if (validate) {
      assert.deepEqual(await validate(slug, { value: 'same' }, false), { ok: true });
      assert.deepEqual(await validate(slug, { value: 'same' }, true), { ok: true });
      assert.equal((await validate(slug, {}, false)).ok, !input.required || input.defaultValue !== undefined);
      assert.deepEqual(await validate(slug, {}, true), { ok: true });
      assert.equal((await validate(slug, { value: null }, false)).ok, !input.required);
      assert.equal((await validate(slug, { value: null }, true)).ok, !input.required);
      assert.equal((await validate(slug, { value: '' }, false)).ok, requiredEmptyAllowed || !input.required);
      assert.equal((await validate(slug, { value: '' }, true)).ok, requiredEmptyAllowed || !input.required);
    }
  }
}

export async function scalarSnapshot(db: CmsDatabase['db'], registry: SchemaRegistry) {
  const result = [];
  for (const [index] of scalarCases.entries()) {
    const slug = 'scalar_' + index;
    const table = 'ec_' + slug;
    result.push({ field: await registry.getField(slug, 'value'),
      columns: (await sql`PRAGMA table_info(${sql.ref(table)})`.execute(db)).rows,
      indexes: (await sql`SELECT name, sql FROM sqlite_master WHERE type = 'index' AND tbl_name = ${table} ORDER BY name`.execute(db)).rows,
      rows: (await sql`SELECT * FROM ${sql.ref(table)} ORDER BY id`.execute(db)).rows });
  }
  return result;
}
