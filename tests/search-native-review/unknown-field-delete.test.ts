// Native real-SQL regression for SEARCHREV06, separate from copied Source credit.
// Native5 permits unknown persisted top-level field types; both Native and pinned
// Source expose them as string plus unsupportedType { type: raw, path: 'type' }.
// No concurrent, principal, credential, session or HTTP fixture is exercised.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { sql } from 'kysely';
import { openSqlite } from '../../src/lib/server/database/sqlite.ts';
import { migrateCms } from '../../src/lib/server/database/migrations.ts';
import { SchemaRegistry } from '../../src/lib/server/database/registry.ts';
import type { CmsDatabase } from '../../src/lib/server/database/contract.ts';

describe('Native deletion of a persisted future field type', () => {
  let database: CmsDatabase; let registry: SchemaRegistry;
  beforeEach(async () => {
    database = openSqlite(':memory:'); await migrateCms(database);
    registry = new SchemaRegistry(database);
    await registry.createCollection({ slug: 'articles', label: 'Articles', supports: ['search'] });
    await registry.createField('articles', { slug: 'future_text', label: 'Future text', type: 'string', searchable: true });
    // Actual SQL models a persisted plugin/future schema type while retaining its
    // real TEXT column. The ordinary registry projection supplies the raw marker.
    await database.db.updateTable('_cms_fields').set({ type: 'futureText' as any }).where('slug', '=', 'future_text').execute();
  });
  afterEach(async () => { await database.close(); });
  it('deletes the searchable unknown top-level type while search is inactive', async () => {
    expect(await registry.getField('articles', 'future_text')).toMatchObject({ type: 'string', searchable: true, unsupportedType: { type: 'futureText', path: 'type' } });
    await expect(registry.deleteField('articles', 'future_text')).resolves.toBeUndefined();
    expect(await registry.getField('articles', 'future_text')).toBeNull();
    const result = await sql<{ name: string }>`PRAGMA table_info(ec_articles)`.execute(database.db);
    expect(result.rows.map(row => row.name)).not.toContain('future_text');
  });
});
