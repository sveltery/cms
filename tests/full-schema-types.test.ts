import test from 'node:test';
import assert from 'node:assert/strict';
import { openSqlite } from '../src/lib/server/database/sqlite.ts';
import { migrateCms } from '../src/lib/server/database/migrations.ts';
import { SchemaRegistry } from '../src/lib/server/database/registry.ts';
import { sql } from 'kysely';

// Supplemental integration gate exercising the existing public registry before
// porting the complete pinned Zod generator declarations. No missing import or
// test registration is accepted as red evidence.
test('the persisted registry creates every pinned EmDash 1.1.0 field type', async () => {
  const database = openSqlite(':memory:');
  try {
    await migrateCms(database);
    const registry = new SchemaRegistry(database);
    await registry.createCollection({ slug: 'everything', label: 'Everything' });
    const types = ['string', 'text', 'url', 'number', 'integer', 'boolean', 'datetime', 'select',
      'multiSelect', 'portableText', 'image', 'file', 'reference', 'json', 'slug', 'repeater', 'blocks'];
    for (const type of types) {
      await assert.doesNotReject(() => registry.createField('everything', {
        slug: 'field_' + type.toLowerCase(), label: type, type
      }), `public createField must support ${type}`);
    }
    assert.deepEqual((await registry.listFields((await registry.getCollection('everything'))!.id)).map(field => field.type), types);
    const columns = (await sql<{name: string; type: string}>`PRAGMA table_info(ec_everything)`.execute(database.db)).rows;
    assert.equal(columns.find(column => column.name === 'field_number')!.type, 'REAL');
    assert.equal(columns.find(column => column.name === 'field_boolean')!.type, 'INTEGER');
  } finally { await database.close(); }
});

// Ported assertion scope: packages/core/tests/unit/schema/registry.test.ts
// "defaults collections to routable and preserves explicit opt-out".
// Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
test('defaults collections to routable and preserves explicit opt-out', async () => {
  const database = openSqlite(':memory:');
  try {
    await migrateCms(database);
    const registry = new SchemaRegistry(database);
    const routable = await registry.createCollection({ slug: 'posts', label: 'Posts' });
    assert.equal((routable as unknown as {routable: boolean}).routable, true);
    const internal = await registry.createCollection({ slug: 'blocks', label: 'Blocks', routable: false });
    assert.equal((internal as unknown as {routable: boolean}).routable, false);
    assert.equal((await registry.updateCollection('blocks', { routable: true }) as unknown as {routable: boolean}).routable, true);
  } finally { await database.close(); }
});
