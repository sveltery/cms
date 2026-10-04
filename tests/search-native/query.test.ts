// Supplemental Native real-SQL requirements, separate from pinned Source credit.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { sql } from 'kysely';
import { openSqlite } from '../../src/lib/server/database/sqlite.ts';
import { migrateCms } from '../../src/lib/server/database/migrations.ts';
import { SchemaRegistry } from '../../src/lib/server/database/registry.ts';
import { ContentRepository } from '../../src/lib/server/database/lifecycle/upstream/database/repositories/content.ts';
import { FTSManager } from '../../src/lib/server/content-picker/fts-manager.ts';
import { encodeCursor } from '../../src/lib/server/database/lifecycle/upstream/database/repositories/types.ts';
import { registerLifecycleDatabase } from '../../src/lib/server/database/lifecycle/upstream/host.ts';
import type { CmsDatabase } from '../../src/lib/server/database/contract.ts';

// A computed specifier lets the actual missing product module reject inside the
// Native expectation instead of causing a test-collection/fixture import stop.
const queryModule = '../../src/lib/server/search/' + 'query.ts';
async function queryApi() {
  let module: any;
  await expect((async () => { module = await import(queryModule); })()).resolves.toBeUndefined();
  return module;
}
describe('Native full search over actual canonical SQLite', () => {
  let database: CmsDatabase;
  let owner: FTSManager;
  let repo: ContentRepository;
  beforeEach(async () => {
    database = openSqlite(':memory:');
    await migrateCms(database);
    registerLifecycleDatabase(database, { after: task => { void task(); } });
    const registry = new SchemaRegistry(database);
    await registry.createCollection({ slug: 'articles', label: 'Articles', supports: ['search'] });
    await registry.createField('articles', { slug: 'title', label: 'Title', type: 'string', searchable: true });
    await registry.createField('articles', { slug: 'body', label: 'Body', type: 'text', searchable: true });
    owner = new FTSManager(database.db as any);
    await owner.enableSearch('articles');
    repo = new ContentRepository(database.db as any);
    for (let i = 1; i <= 5; i++) await repo.create({ type: 'articles', slug: `report-${i}`, status: 'published', data: { title: i === 1 ? 'Quarterly report 1 bright <script>unsafe</script>' : `Quarterly report ${i}`, body: 'financial report' } });
    await repo.create({ type: 'articles', slug: 'draft-only', status: 'draft', data: { title: 'Draft report secret', body: 'financial confidential' } });
  });
  afterEach(async () => { await database.close(); });
  it('starts from the real single Native FTS owner and real six-row content table', async () => {
    expect(owner.getFtsTableName('articles')).toBe('_cms_fts_articles');
    expect(await owner.ftsTableExists('articles')).toBe(true);
    const rows = await sql<{ count: number }>`SELECT COUNT(*) AS count FROM ec_articles`.execute(database.db);
    expect(rows.rows[0]?.count).toBe(6);
  });
  it('searches five published rows and excludes the stored draft', async () => {
    const api = await queryApi();
    const result = await api.searchWithDb(database.db, 'report', { collections: ['articles'] });
    expect(result.items).toHaveLength(5);
    expect(result.items.some((item: any) => item.slug === 'draft-only')).toBe(false);
  });
  it('walks all matches once with opaque pagination', async () => {
    const api = await queryApi(); const ids: string[] = []; let cursor: string | undefined; let pages = 0;
    do { const page = await api.searchWithDb(database.db, 'report', { limit: 2, cursor }); ids.push(...page.items.map((item: any) => item.id)); cursor = page.nextCursor; } while (cursor && ++pages < 10);
    expect(ids).toHaveLength(5); expect(new Set(ids).size).toBe(5);
  });
  it('rejects a foreign endpoint cursor', async () => {
    const api = await queryApi();
    await expect(api.searchWithDb(database.db, 'report', { cursor: encodeCursor('1', 'content-list') })).rejects.toThrow(/Invalid pagination cursor/);
  });
  it('rejects a cursor above the pinned 10000-row bound', async () => {
    const api = await queryApi();
    await expect(api.searchWithDb(database.db, 'report', { cursor: encodeCursor('10001', 'search') })).rejects.toThrow(/Invalid pagination cursor/);
  });
  it('returns title-only published autocomplete', async () => {
    const api = await queryApi(); const result = await api.getSuggestions(database.db, 'rep', { limit: 20 });
    expect(result).toHaveLength(5); expect(result.every((item: any) => item.title.startsWith('Quarterly'))).toBe(true);
  });
  it('escapes stored HTML while preserving mark highlights', async () => {
    const api = await queryApi(); const result = await api.searchWithDb(database.db, 'bright', { collections: ['articles'] });
    expect(result.items).toHaveLength(1); expect(result.items[0].snippet).toContain('<mark>bright</mark>');
    expect(result.items[0].snippet).toContain('&lt;script&gt;'); expect(result.items[0].snippet).not.toContain('<script>');
  });
  it('keeps title-scoped results separate from body matches', async () => {
    const api = await queryApi();
    expect((await api.searchWithDb(database.db, 'financial', { scope: 'title' })).items).toEqual([]);
    expect((await api.searchWithDb(database.db, 'financial')).items).toHaveLength(5);
  });
  it('reports the actual indexed document count', async () => {
    const api = await queryApi();
    expect((await api.getSearchStats(database.db)).collections.articles.indexed).toBe(6);
  });
});
