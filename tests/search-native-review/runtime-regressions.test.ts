// Supplemental Native regressions for fresh review SEARCHREV01..05.
// Ordinary sequential SQL snapshots/batches and supplied health mocks only.
// No concurrent operation, identity, credential, session or HTTP fixture/probe.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sql } from 'kysely';
import { openSqlite } from '../../src/lib/server/database/sqlite.ts';
import { migrateCms } from '../../src/lib/server/database/migrations.ts';
import { SchemaRegistry } from '../../src/lib/server/database/registry.ts';
import { FTSManager } from '../../src/lib/server/content-picker/fts-manager.ts';
import { searchWithDb } from '../../src/lib/server/search/query.ts';
import { ensureSearchHealthy } from '../../src/lib/server/search/http.ts';
import type { CmsDatabase, Field } from '../../src/lib/server/database/contract.ts';

type PlannedField = { id?: string; slug: string; type: string; searchable: boolean; sortOrder: number };
type Plan = { before: Parameters<CmsDatabase['atomicBatch']>[0]; after: Parameters<CmsDatabase['atomicBatch']>[0] };
// This finite proposed planning input binds a real previously read field identity.
// R1 accepts/ignores the fourth JavaScript argument; R2 must guard its exact input.
type Planner = { schemaMutationPlan(slug: string, supports: readonly string[], change: (fields: readonly PlannedField[]) => readonly PlannedField[], expectedField?: Field): Promise<Plan> };
const planner = (owner: FTSManager) => owner as unknown as Planner;

describe('Native search review regressions over real canonical SQL', () => {
  let database: CmsDatabase; let registry: SchemaRegistry; let owner: FTSManager;
  beforeEach(async () => {
    database = openSqlite(':memory:'); await migrateCms(database);
    registry = new SchemaRegistry(database);
    await registry.createCollection({ slug: 'articles', label: 'Articles', supports: ['search'] });
    await registry.createField('articles', { slug: 'title', label: 'Title', type: 'string', searchable: true, sortOrder: 10 });
    await registry.createField('articles', { slug: 'summary', label: 'Summary', type: 'text', searchable: false, sortOrder: 20 });
    await sql`INSERT INTO ec_articles(id, slug, status, title, summary) VALUES('review-row', 'review-row', 'published', 'Ordinary title', 'unexpected quokka')`.execute(database.db);
    owner = new FTSManager(database.db as any);
  });
  afterEach(async () => { await database.close(); });
  async function columns() {
    const result = await sql<{ name: string }>`PRAGMA table_info(_cms_fts_articles)`.execute(database.db);
    return result.rows.map(row => row.name).slice(2);
  }
  const enableSummary = (fields: readonly PlannedField[]) => fields.map(field => field.slug === 'summary' ? { ...field, searchable: true } : field);
  async function persistSummary(plan: Plan, targetId: string) {
    await database.atomicBatch([...plan.before,
      database.db.updateTable('_cms_fields').set({ searchable: 1 }).where('id', '=', targetId).returningAll().compile(),
      ...plan.after]);
  }
  it('uses post-edit field order for a combined searchable and nonnegative sortOrder edit', async () => {
    await owner.enableSearch('articles', { weights: { title: 10, summary: 2 } });
    await registry.updateField('articles', 'summary', { searchable: true, sortOrder: 0 });
    expect(await columns()).toEqual(await owner.getSearchableFields('articles'));
    const result = await searchWithDb(database.db as any, 'quokka');
    expect(result.items[0]?.snippet).toContain('<mark>quokka</mark>');
  });
  it.each([null, JSON.stringify({ enabled: false })])('rejects a stale inactive config plan after an ordinary sequential enable: %s', async config => {
    await database.db.updateTable('_cms_collections').set({ search_config: config }).where('slug', '=', 'articles').execute();
    const target = (await registry.getField('articles', 'summary'))!;
    const plan = await planner(owner).schemaMutationPlan('articles', ['search'], enableSummary, target);
    await owner.enableSearch('articles');
    await expect(persistSummary(plan, target.id)).rejects.toThrow(/CHECK constraint failed/);
    expect((await registry.getField('articles', 'summary'))?.searchable).toBe(false);
    expect(await columns()).toEqual(['title']);
  });
  it('rejects a previously resolved field ID that no longer identifies the captured field before any FTS batch commit', async () => {
    await owner.enableSearch('articles');
    const target = (await registry.getField('articles', 'summary'))!;
    await database.db.updateTable('_cms_fields').set({ id: 'ordinary-replacement-field' }).where('id', '=', target.id).execute();
    await expect((async () => {
      const plan = await planner(owner).schemaMutationPlan('articles', ['search'], enableSummary, target);
      await persistSummary(plan, target.id);
    })()).rejects.toThrow(/CHECK constraint failed|NOT_FOUND|CONFLICT/);
    expect((await registry.getField('articles', 'summary'))?.searchable).toBe(false);
    expect(await columns()).toEqual(['title']);
  });
  it('derives unchanged supports from the same actual snapshot as the field plan', async () => {
    await database.db.updateTable('_cms_collections').set({ supports: '[]' }).where('slug', '=', 'articles').execute();
    await owner.enableSearch('articles'); // Source explicitly permits enabling independently of supports.
    const previouslyRead = (await registry.getCollection('articles'))!;
    const target = (await registry.getField('articles', 'summary'))!;
    await database.db.updateTable('_cms_collections').set({ supports: '["search"]' }).where('slug', '=', 'articles').execute();
    const plan = await planner(owner).schemaMutationPlan('articles', previouslyRead.supports, enableSummary, target);
    await persistSummary(plan, target.id);
    expect((await owner.getSearchConfig('articles'))?.enabled).toBe(true);
    expect(await columns()).toEqual(await owner.getSearchableFields('articles'));
  });
});

describe('Native optional health hosting preserves pinned bounded non-fatal behavior', () => {
  let database: CmsDatabase;
  beforeEach(() => { database = openSqlite(':memory:'); });
  afterEach(async () => { vi.restoreAllMocks(); vi.useRealTimers(); await database.close(); });
  it('swallows a supplied repair rejection and caches the checked state', async () => {
    const verify = vi.spyOn(FTSManager.prototype, 'verifyAndRepairAll').mockRejectedValue(new Error('ordinary supplied repair rejection'));
    await expect(ensureSearchHealthy(database.db as any)).resolves.toBeUndefined();
    await expect(ensureSearchHealthy(database.db as any)).resolves.toBeUndefined();
    expect(verify).toHaveBeenCalledTimes(1);
  });
  it('bounds a supplied stalled repair at the pinned 30000ms owner deadline without failing the caller', async () => {
    vi.useFakeTimers(); let finish!: (value: number) => void;
    vi.spyOn(FTSManager.prototype, 'verifyAndRepairAll').mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    let settled = false;
    const task = ensureSearchHealthy(database.db as any);
    void task.then(() => { settled = true; }, () => { settled = false; });
    try {
      await vi.advanceTimersByTimeAsync(30_000);
      expect(settled).toBe(true);
    } finally { finish(0); await task.catch(() => undefined); }
  });
  it('anchors actual repair work through the supplied existing host lifetime callback', async () => {
    vi.spyOn(FTSManager.prototype, 'verifyAndRepairAll').mockResolvedValue(0);
    const keepAlive = vi.fn<(task: Promise<void>) => void>();
    const health = ensureSearchHealthy as unknown as (db: CmsDatabase['db'], keepAlive?: (task: Promise<void>) => void) => Promise<unknown>;
    await health(database.db, keepAlive);
    expect(keepAlive).toHaveBeenCalledTimes(1);
    await expect(keepAlive.mock.calls[0][0]).resolves.toBeUndefined();
  });
});
