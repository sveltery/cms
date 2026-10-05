// Supplemental Native creator/default controls, not copied Source test credit.
// EmDash 1.1.0 pin 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; registry.ts createField
// explicitly writes searchable0 for omitted input; Source012 SQL also defaults0.
// MIT notice retained at notices/emdash-MIT.txt. Actual public41/provider15 host
// is selected only by the qualified existing test-only resolver baseline mode.
// No HTTP, principal, credential, session, concurrency or race fixture is used.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { sql } from 'kysely';
import { openSqlite } from '../../src/lib/server/database/sqlite.ts';
import { migrateCms } from '../../src/lib/server/database/migrations.ts';
import { SchemaRegistry } from '../../src/lib/server/database/registry.ts';
import type { CmsDatabase } from '../../src/lib/server/database/contract.ts';

describe('Native field creator and physical search defaults', () => {
  let database: CmsDatabase; let registry: SchemaRegistry; let collectionId: string;
  beforeEach(async () => {
    database = openSqlite(':memory:'); await migrateCms(database);
    registry = new SchemaRegistry(database);
    collectionId = (await registry.createCollection({ slug: 'articles', label: 'Articles' })).id;
  });
  afterEach(async () => { await database.close(); });
  it('uses the Source API false default when searchable is omitted', async () => {
    const field = await registry.createField('articles', { slug: 'omitted_flag', label: 'Omitted flag', type: 'string' });
    expect(field.searchable).toBe(false);
    const row = await database.db.selectFrom('_cms_fields').select('searchable').where('id', '=', field.id).executeTakeFirstOrThrow();
    expect(row.searchable).toBe(0);
  });
  it('preserves explicit false through the actual field creator', async () => {
    const field = await registry.createField('articles', { slug: 'explicit_false', label: 'Explicit false', type: 'string', searchable: false });
    expect(field.searchable).toBe(false);
    const row = await database.db.selectFrom('_cms_fields').select('searchable').where('id', '=', field.id).executeTakeFirstOrThrow();
    expect(row.searchable).toBe(0);
  });
  it('preserves the Source SQL zero default for omitted raw metadata', async () => {
    // This is an ordinary real metadata insert; no table/column DDL or defaults
    // are supplied by the fixture. Provider15's actual defaults fill omissions.
    await sql`INSERT INTO _cms_fields(id, collection_id, slug, label, type, column_type)
      VALUES('raw-default-field', ${collectionId}, 'raw_default', 'Raw default', 'string', 'TEXT')`.execute(database.db);
    const row = await database.db.selectFrom('_cms_fields').select('searchable').where('id', '=', 'raw-default-field').executeTakeFirstOrThrow();
    expect(row.searchable).toBe(0);
    const catalogue = await sql<{ name: string; dflt_value: string | null }>`PRAGMA table_info(_cms_fields)`.execute(database.db);
    expect(catalogue.rows.find(column => column.name === 'searchable')?.dflt_value).toBe('0');
  });
});
