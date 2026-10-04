import { afterEach, expect, it } from 'vitest';
import { sql } from 'kysely';
import { openSqlite } from '../../src/lib/server/database/sqlite.ts';
import { migrateCms } from '../../src/lib/server/database/migrations.ts';
import { SchemaRegistry } from '../../src/lib/server/database/registry.ts';
import { registerLifecycleDatabase } from '../../src/lib/server/database/lifecycle/upstream/host.ts';
import { ContentRepository } from '../../src/lib/server/database/lifecycle/upstream/database/repositories/content.ts';
import type { CmsDatabase } from '../../src/lib/server/database/contract.ts';

// Supplemental ordinary SQL/pure requirements. No principal, session, HTTP,
// credentials, publication race or scheduled maintenance is constructed here.
const opened: CmsDatabase[] = [];
const before = new Date('2029-01-01T00:00:00.000Z');
const march = { from: '2030-03-01T00:00:00.000Z', to: '2030-04-01T00:00:00.000Z', limit: 100 };
async function fixture() {
  const database = openSqlite(':memory:'); opened.push(database);
  await migrateCms(database); registerLifecycleDatabase(database);
  const registry = new SchemaRegistry(database);
  for (const slug of ['post', 'page']) {
    await registry.createCollection({ slug, label: slug === 'post' ? 'Posts' : 'Pages' });
    await registry.createField(slug, { slug: 'title', label: 'Title', type: 'string' });
  }
  return { database, registry, repo: new ContentRepository(database.db as any) };
}
afterEach(async () => { for (const database of opened.splice(0)) await database.close(); });
async function serverModule() {
  const specifier = '../../src/lib/server/calendar/' + 'handlers.ts';
  let module: any;
  await expect((async () => { module = await import(specifier); })()).resolves.toBeUndefined();
  return module;
}
async function clientModule() {
  const specifier = '../../src/lib/calendar/' + 'calendar.ts';
  let module: any;
  await expect((async () => { module = await import(specifier); })()).resolves.toBeUndefined();
  return module;
}
async function apiModule() {
  const specifier = '../../src/lib/calendar/' + 'api.ts';
  let module: any;
  await expect((async () => { module = await import(specifier); })()).resolves.toBeUndefined();
  return module;
}

it('storage control: first publication scheduling and removal preserve the real row', async () => {
  const { repo } = await fixture();
  const draft = await repo.create({ type: 'post', slug: 'draft', data: { title: 'Draft' } });
  const scheduled = await repo.schedule('post', draft.id, '2030-03-02T09:00:00.000Z', before);
  expect(scheduled?.status).toBe('scheduled');
  expect(scheduled?.publishedAt).toBeNull();
  expect(scheduled?.scheduledAt).toBe('2030-03-02T09:00:00.000Z');
  const removed = await repo.unschedule('post', draft.id);
  expect(removed?.status).toBe('draft');
  expect(removed?.scheduledAt).toBeNull();
  expect(removed?.data.title).toBe('Draft');
});

it('storage control: scheduling changes keeps an already published entry live', async () => {
  const { repo } = await fixture();
  const live = await repo.create({ type: 'post', slug: 'live', data: { title: 'Live' }, status: 'published', publishedAt: '2030-03-01T09:00:00.000Z' });
  const scheduled = await repo.schedule('post', live.id, '2030-03-02T09:00:00.000Z', before);
  expect(scheduled?.status).toBe('published');
  expect(scheduled?.publishedAt).toBe('2030-03-01T09:00:00.000Z');
  expect(scheduled?.scheduledAt).toBe('2030-03-02T09:00:00.000Z');
  const removed = await repo.unschedule('post', live.id);
  expect(removed?.status).toBe('published');
  expect(removed?.scheduledAt).toBeNull();
});

it('storage control: due selection excludes later and trashed rows', async () => {
  const { repo } = await fixture();
  const first = await repo.create({ type: 'post', slug: 'first', data: { title: 'First' } });
  const later = await repo.create({ type: 'post', slug: 'later', data: { title: 'Later' } });
  const trashed = await repo.create({ type: 'post', slug: 'trashed', data: { title: 'Trashed' } });
  await repo.schedule('post', first.id, '2030-03-02T09:00:00.000Z', before);
  await repo.schedule('post', later.id, '2030-03-05T09:00:00.000Z', before);
  await repo.schedule('post', trashed.id, '2030-03-01T09:00:00.000Z', before);
  await repo.delete('post', trashed.id);
  expect((await repo.findReadyToPublish('post', 100, new Date('2030-03-03T09:00:00.000Z'))).map(item => item.id)).toEqual([first.id]);
});

it('calendar lists both events for published content with scheduled changes', async () => {
  const { handleCalendarEntries } = await serverModule();
  const { database, repo } = await fixture();
  const live = await repo.create({ type: 'post', slug: 'live', data: { title: 'Live' }, status: 'published', publishedAt: '2030-03-01T09:00:00.000Z' });
  await repo.schedule('post', live.id, '2030-03-02T09:00:00.000Z', before);
  const result = await handleCalendarEntries(database.db, march);
  expect(result.success).toBe(true);
  expect(result.data.items.map(item => [item.id, item.status, item.kind, item.at])).toEqual([
    [live.id, 'published', 'published', '2030-03-01T09:00:00.000Z'],
    [live.id, 'published', 'scheduled', '2030-03-02T09:00:00.000Z']
  ]);
});

it('calendar walks ties in collection and event order without skipping an event', async () => {
  const { handleCalendarEntries } = await serverModule();
  const { database, repo } = await fixture();
  const at = '2030-03-01T09:00:00.000Z';
  const page = await repo.create({ type: 'page', slug: 'page', data: { title: 'Page' }, status: 'published', publishedAt: at });
  const post = await repo.create({ type: 'post', slug: 'post', data: { title: 'Post' }, status: 'published', publishedAt: at });
  await repo.schedule('post', post.id, at, before);
  let cursor: string | undefined;
  const seen: string[] = [];
  for (let index = 0; index < 4; index++) {
    const result = await handleCalendarEntries(database.db, { ...march, limit: 1, cursor });
    expect(result.success).toBe(true);
    seen.push(...result.data.items.map(item => `${item.collection}:${item.id}:${item.kind}`));
    cursor = result.data.nextCursor;
    if (!cursor) break;
  }
  expect(seen).toEqual([`page:${page.id}:published`, `post:${post.id}:published`, `post:${post.id}:scheduled`]);
  expect(cursor).toBeUndefined();
});

it('calendar uses persisted hidden and titleField metadata without changing content', async () => {
  const { handleCalendarEntries } = await serverModule();
  const { database, repo, registry } = await fixture();
  await registry.createField('post', { slug: 'headline', label: 'Headline', type: 'string' });
  await registry.updateCollection('post', { titleField: 'headline' });
  await registry.updateCollection('page', { hidden: true });
  const at = '2030-03-01T09:00:00.000Z';
  const visible = await repo.create({ type: 'post', slug: 'visible', data: { title: 'Title', headline: 'Headline' }, status: 'published', publishedAt: at });
  await repo.create({ type: 'page', slug: 'hidden', data: { title: 'Hidden' }, status: 'published', publishedAt: at });
  const snapshot = (await sql`SELECT * FROM ec_post`.execute(database.db)).rows;
  const result = await handleCalendarEntries(database.db, march);
  expect(result.success).toBe(true);
  expect(result.data.items.map(item => [item.id, item.title])).toEqual([[visible.id, 'Headline']]);
  expect((await sql`SELECT * FROM ec_post`.execute(database.db)).rows).toEqual(snapshot);
});

it('calendar returns the original invalid-cursor envelope', async () => {
  const { handleCalendarEntries } = await serverModule();
  const { database } = await fixture();
  expect(await handleCalendarEntries(database.db, { ...march, cursor: 'not-a-cursor' })).toMatchObject({ success: false, error: { code: 'INVALID_CURSOR' } });
});

it('calendar placement uses site timezone and the time entries loaded', async () => {
  const { toCalendarItems } = await clientModule();
  const items = toCalendarItems([{ collection: 'post', id: 'one', locale: 'en', title: 'One', status: 'scheduled', kind: 'scheduled', at: '2026-10-15T03:30:00.000Z' }],
    { timeZone: 'America/New_York', loadedAt: Date.parse('2026-10-15T03:29:00.000Z'), collectionOrder: ['post'] });
  expect(items[0]).toMatchObject({ key: 'post:one:scheduled', day: '2026-10-14', state: 'scheduled' });
});

it('calendar filters intersect collection, locale and state without changing the input', async () => {
  const { filterItems, toCalendarItems } = await clientModule();
  const items = toCalendarItems([
    { collection: 'post', id: 'en', locale: 'en', title: 'English', status: 'published', kind: 'published', at: '2026-10-01T09:00:00.000Z' },
    { collection: 'post', id: 'fr', locale: 'fr', title: 'French', status: 'scheduled', kind: 'scheduled', at: '2026-10-20T09:00:00.000Z' }
  ], { timeZone: 'UTC', loadedAt: Date.parse('2026-10-15T12:00:00.000Z'), collectionOrder: ['post'] });
  const snapshot = structuredClone(items);
  expect(filterItems(items, { collections: ['post'], locales: ['fr'], states: ['scheduled'] }).map(item => item.id)).toEqual(['fr']);
  expect(items).toEqual(snapshot);
});

it('calendar client bounds a repeating page stream to ten pages and de-duplicates event keys', async () => {
  const { fetchCalendarRange } = await apiModule();
  const originalFetch = globalThis.fetch;
  let count = 0;
  try {
    globalThis.fetch = async () => {
      count++;
      return Response.json({ success: true, data: { items: [{ collection: 'post', id: 'same', locale: 'en', title: 'Same', status: 'published', kind: 'published', at: '2026-10-01T09:00:00.000Z' }], nextCursor: `cursor-${count}` } });
    };
    const result = await fetchCalendarRange(march.from, march.to);
    expect(count).toBe(10);
    expect(result.truncated).toBe(true);
    expect(result.items).toHaveLength(1);
  } finally { globalThis.fetch = originalFetch; }
});

it('calendar client sends bounds and cursor through the ordinary calendar API', async () => {
  const { fetchCalendarPage } = await apiModule();
  const originalFetch = globalThis.fetch;
  let request: string | undefined;
  try {
    globalThis.fetch = async input => { request = String(input); return Response.json({ success: true, data: { items: [] } }); };
    expect(await fetchCalendarPage({ from: march.from, to: march.to, cursor: 'a+b/c=' })).toEqual({ items: [] });
    const url = new URL(request!, 'http://calendar.invalid');
    expect(url.pathname).toBe('/api/calendar');
    expect(Object.fromEntries(url.searchParams)).toEqual({ from: march.from, to: march.to, limit: '100', cursor: 'a+b/c=' });
  } finally { globalThis.fetch = originalFetch; }
});
