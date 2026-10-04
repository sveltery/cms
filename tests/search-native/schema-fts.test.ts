// Supplemental Native real-schema FTS lifecycle requirements.
// Source registry contract: EmDash1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e
// registry.ts syncSearchState/createField/updateField/deleteField/deleteCollection.
// No Source assertion credit; no identity/session/HTTP fixture is exercised.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { sql } from 'kysely';
import { openSqlite } from '../../src/lib/server/database/sqlite.ts';
import { migrateCms } from '../../src/lib/server/database/migrations.ts';
import { SchemaRegistry } from '../../src/lib/server/database/registry.ts';
import { FTSManager } from '../../src/lib/server/content-picker/fts-manager.ts';
import type { CmsDatabase } from '../../src/lib/server/database/contract.ts';

describe('Native schema mutation maintains the same real FTS owner', () => {
  let database: CmsDatabase; let registry: SchemaRegistry; let owner: FTSManager;
  beforeEach(async () => {
    database = openSqlite(':memory:'); await migrateCms(database);
    registry = new SchemaRegistry(database);
    await registry.createCollection({ slug: 'articles', label: 'Articles', supports: ['search'] });
    await registry.createField('articles', { slug: 'title', label: 'Title', type: 'string', searchable: true });
    await registry.createField('articles', { slug: 'summary', label: 'Summary', type: 'text', searchable: false });
    await sql`INSERT INTO ec_articles(id, slug, status, title, summary) VALUES('ordinary-row', 'ordinary-row', 'published', 'Relations between languages', 'unexpected quokka')`.execute(database.db);
    owner = new FTSManager(database.db as any);
    await owner.enableSearch('articles', { tokenize: 'trigram', weights: { title: 10 } });
  });
  afterEach(async () => { await database.close(); });
  async function definition() {
    const result = await sql<{ sql: string }>`SELECT sql FROM sqlite_master WHERE type='table' AND name='_cms_fts_articles'`.execute(database.db);
    return result.rows[0]?.sql ?? '';
  }
  it('adds a searchable field to the real index while preserving tokenizer and weights', async () => {
    await registry.createField('articles', { slug: 'notes', label: 'Notes', type: 'text', searchable: true });
    expect(await definition()).toContain('notes');
    expect(await definition()).toContain("tokenize='trigram'");
    expect(await owner.getSearchConfig('articles')).toEqual({ enabled: true, weights: { title: 10 }, tokenize: 'trigram' });
  });
  it('indexes existing values after a field becomes searchable', async () => {
    await registry.updateField('articles', 'summary', { searchable: true });
    expect(await definition()).toContain('summary');
    const result = await sql<{ id: string }>`SELECT id FROM _cms_fts_articles WHERE _cms_fts_articles MATCH 'quokka'`.execute(database.db);
    expect(result.rows.map(row => row.id)).toEqual(['ordinary-row']);
  });
  it('removes dependent triggers before dropping a searchable content column', async () => {
    await expect(registry.deleteField('articles', 'title')).resolves.toBeUndefined();
    expect(await owner.ftsTableExists('articles')).toBe(false);
    expect(await owner.getSearchConfig('articles')).toEqual({ enabled: false, weights: { title: 10 }, tokenize: 'trigram' });
  });
  it('disables an active index after the final searchable field is disabled', async () => {
    await registry.updateField('articles', 'title', { searchable: false });
    expect(await owner.getSearchConfig('articles')).toEqual({ enabled: false, weights: { title: 10 }, tokenize: 'trigram' });
    expect(await owner.ftsTableExists('articles')).toBe(false);
  });
  it('disables after search support is removed and does not implicitly re-enable it', async () => {
    await registry.updateCollection('articles', { supports: [] });
    expect(await owner.getSearchConfig('articles')).toEqual({ enabled: false, weights: { title: 10 }, tokenize: 'trigram' });
    expect(await owner.ftsTableExists('articles')).toBe(false);
    await registry.updateCollection('articles', { supports: ['search'] });
    expect(await owner.getSearchConfig('articles')).toEqual({ enabled: false, weights: { title: 10 }, tokenize: 'trigram' });
    expect(await owner.ftsTableExists('articles')).toBe(false);
  });
  it('drops the real FTS virtual table before force-deleting its content collection', async () => {
    await registry.deleteCollection('articles', { force: true });
    expect(await owner.ftsTableExists('articles')).toBe(false);
    expect(await registry.getCollection('articles')).toBeNull();
  });
});
