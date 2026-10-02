// Supplemental draft-only repository/service pagination evidence informed by
// EmDash 1.1.0, immutable 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e:
// packages/core/src/database/repositories/content.ts:1691 and types.ts:252.
// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// These original 103-row fixtures do not port published/revision lifecycle,
// REST/MCP/browser declarations, or earn complete upstream assertion credit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sql } from 'kysely';
import { collectionUpdateStorage } from './helpers/collection-update-fixture.ts';
import { migrateCms } from '../src/lib/server/database/migrations.ts';
import { SchemaRegistry } from '../src/lib/server/database/registry.ts';
import { DraftRepository } from '../src/lib/server/database/entries.ts';
import { cmsService, type ServerPrincipal } from '../src/lib/server/database/service.ts';
import { decodeCursor, encodeCursor, InvalidCursorError } from '../src/lib/server/database/trash-cursor.ts';
import type { CmsDatabase, DraftEntry, Page, TrashedDraftSummary } from '../src/lib/server/database/contract.ts';

const principal: ServerPrincipal = { id: 'trash-reader', permissions: [
  'content:create', 'content:read', 'content:read_drafts', 'content:edit_any', 'content:delete_any'
] };
const expected = (row: DraftEntry) => ({ version: row.version, updatedAt: row.updatedAt });
const ids = (page: Page<TrashedDraftSummary>) => page.items.map(row => row.id);
const dates = ['2026-01-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z', '2026-03-01T00:00:00.000Z'];

async function seed(database: CmsDatabase) {
  await migrateCms(database);
  const registry = new SchemaRegistry(database);
  await registry.createCollection({ slug: 'posts', label: 'Posts' });
  await registry.createField('posts', { slug: 'title', label: 'Title', type: 'string' });
  await registry.createField('posts', { slug: 'body', label: 'Body', type: 'text' });
  const service = cmsService(database, principal);
  const retained: (DraftEntry & { deletedAt: string })[] = [];
  for (let index = 0; index < 103; index++) {
    const locale = ['en', 'fr', 'de'][index % 3];
    const row = await service.createDraft({ type: 'posts', locale, slug: `retained-${index}`,
      data: { title: `Retained ${index} — 日本語`, body: `retained body ${index}\0${'x'.repeat(256)}` } });
    await service.deleteDraft({ type: 'posts', id: row.id, locale, expected: expected(row) });
    // Distinct dates interleaved with locales and large tied groups exercise both
    // parts of the descending keyset predicate across page boundaries.
    retained.push({ ...row, deletedAt: dates[Math.floor(index / 4) % dates.length] });
  }
  for (const deletedAt of dates) {
    const group = retained.filter(row => row.deletedAt === deletedAt).map(row => row.id);
    await sql`UPDATE ec_posts SET deleted_at = ${deletedAt} WHERE id IN (${sql.join(group)})`.execute(database.db);
  }
  const active = await service.createDraft({ type: 'posts', data: { title: 'Active excluded', body: 'active body' } });
  retained.sort((left, right) => right.deletedAt.localeCompare(left.deletedAt) || right.id.localeCompare(left.id));
  return { service, retained, active };
}

async function walk(read: (cursor?: string) => Promise<Page<TrashedDraftSummary>>) {
  const rows: TrashedDraftSummary[] = [];
  const lengths: number[] = [];
  const cursors = new Set<string>();
  let cursor: string | undefined;
  do {
    const page = await read(cursor);
    rows.push(...page.items); lengths.push(page.items.length);
    if (page.nextCursor !== undefined) {
      assert.ok(page.items.length > 0, 'a continuation must have a returned boundary row');
      const last = page.items.at(-1)!;
      assert.deepEqual(decodeCursor(page.nextCursor), { orderValue: last.deletedAt, id: last.id });
      assert.equal(cursors.has(page.nextCursor), false, 'a walk must advance its cursor');
      cursors.add(page.nextCursor);
    }
    cursor = page.nextCursor;
  } while (cursor !== undefined);
  assert.equal(new Set(rows.map(row => row.id)).size, rows.length, 'a walk must not repeat rows');
  return { rows, lengths };
}

for (const target of ['Node', 'D1'] as const) {
  test(`${target}: synthetic mixed-status fixture excludes active and published rows before pagination`, { timeout: 30_000 }, async () => {
    const storage = await collectionUpdateStorage(target);
    try {
      await migrateCms(storage.database);
      const database = storage.database;
      // The product creates draft-only tables. This separate, new disposable
      // table probes the read predicate against unsupported persisted statuses;
      // it does not reconstruct a table or implement a published lifecycle.
      await database.db.insertInto('_cms_collections').values({
        id: 'synthetic-mixed', slug: 'mixed', label: 'Synthetic mixed statuses', label_singular: null,
        description: null, supports: '["drafts"]', source: 'manual', version: 1,
        created_at: dates[0], updated_at: dates[0]
      }).execute();
      await sql`CREATE TABLE ec_mixed (
        id TEXT PRIMARY KEY, slug TEXT, status TEXT, author_id TEXT, locale TEXT,
        version INTEGER, created_at TEXT, updated_at TEXT, deleted_at TEXT
      )`.execute(database.db);
      for (const [id, status, deletedAt, locale] of [
        ['published-newest', 'published', dates[2], 'en'],
        ['active-newest', 'draft', null, 'en'],
        ['draft-3', 'draft', dates[1], 'fr'],
        ['published-tie', 'published', dates[1], 'fr'],
        ['draft-2', 'draft', dates[1], 'en'],
        ['draft-1', 'draft', dates[0], 'en']
      ] as const) {
        await sql`INSERT INTO ec_mixed (id, slug, status, author_id, locale, version, created_at, updated_at, deleted_at)
          VALUES (${id}, ${id}, ${status}, 'author', ${locale}, 1, ${dates[0]}, ${dates[0]}, ${deletedAt})`.execute(database.db);
      }
      const service = cmsService(database, principal);
      const repository = new DraftRepository(database);
      const result = await walk(cursor => service.listTrashedDrafts({ type: 'mixed', limit: 1,
        ...(cursor === undefined ? {} : { cursor }) }));
      assert.deepEqual(result.rows.map(row => row.id), ['draft-3', 'draft-2', 'draft-1']);
      assert.deepEqual(result.lengths, [1, 1, 1]);
      assert.ok(result.rows.every(row => row.status === 'draft' && row.title === null));
      assert.deepEqual(ids(await repository.listTrashed('mixed')), ['draft-3', 'draft-2', 'draft-1']);
      assert.deepEqual(ids(await service.listTrashedDrafts({ type: 'mixed', locale: 'fr' })), ['draft-3']);
    } finally { await storage.close(); }
  });

  test(`${target}: 103 retained drafts paginate through repository/service and survive reopen`, { timeout: 90_000 }, async t => {
    const directory = await mkdtemp(join(tmpdir(), `cms-trash-pages-${target.toLowerCase()}-`));
    let storage = await collectionUpdateStorage(target, directory);
    try {
      const seeded = await seed(storage.database);
      let service = seeded.service;
      let repository = new DraftRepository(storage.database);
      const ordered = seeded.retained.map(row => row.id);
      const first = await service.listTrashedDrafts({ type: 'posts' });
      assert.ok(first.nextCursor);
      const savedCursor = first.nextCursor;

      await t.test('default 50, cap 100 and last returned row produce honest continuation', async () => {
        assert.equal(first.items.length, 50);
        assert.deepEqual(ids(first), ordered.slice(0, 50));
        assert.deepEqual(await repository.listTrashed('posts'), first);
        assert.deepEqual(decodeCursor(savedCursor), {
          orderValue: first.items[49].deletedAt, id: first.items[49].id
        });
        const capped = await service.listTrashedDrafts({ type: 'posts', limit: 1000 });
        assert.equal(capped.items.length, 100);
        assert.deepEqual(ids(capped), ordered.slice(0, 100));
        assert.ok(capped.nextCursor);
        assert.deepEqual(decodeCursor(capped.nextCursor), {
          orderValue: capped.items[99].deletedAt, id: capped.items[99].id
        });
        const tail = await service.listTrashedDrafts({ type: 'posts', limit: 1000, cursor: capped.nextCursor });
        assert.deepEqual(ids(tail), ordered.slice(100));
        assert.equal(Object.hasOwn(tail, 'nextCursor'), false);
        assert.equal(first.items.some(row => row.id === seeded.active.id), false);
        for (const row of capped.items) {
          assert.equal(row.status, 'draft'); assert.equal(Object.hasOwn(row, 'data'), false);
          assert.ok(row.title !== null); assert.ok(row.title.includes('日本語')); assert.ok(row.title.length <= 200);
        }
        assert.equal(JSON.stringify(capped).includes('retained body'), false);
      });

      await t.test('full default, custom and repository walks have no duplicates or missing tied rows', async () => {
        const defaultWalk = await walk(cursor => service.listTrashedDrafts({ type: 'posts', ...(cursor === undefined ? {} : { cursor }) }));
        assert.deepEqual(defaultWalk.lengths, [50, 50, 3]);
        assert.deepEqual(defaultWalk.rows.map(row => row.id), ordered);
        const customWalk = await walk(cursor => service.listTrashedDrafts({ type: 'posts', limit: 17, ...(cursor === undefined ? {} : { cursor }) }));
        assert.deepEqual(customWalk.lengths, [17, 17, 17, 17, 17, 17, 1]);
        assert.deepEqual(customWalk.rows.map(row => row.id), ordered);
        const repositoryWalk = await walk(cursor => repository.listTrashed('posts', { limit: 100, ...(cursor === undefined ? {} : { cursor }) }));
        assert.deepEqual(repositoryWalk.lengths, [100, 3]);
        assert.deepEqual(repositoryWalk.rows.map(row => row.id), ordered);
      });

      await t.test('omitted locale includes all locales and each exact-locale walk remains complete', async () => {
        for (const locale of ['en', 'fr', 'de']) {
          const scoped = seeded.retained.filter(row => row.locale === locale);
          const result = await walk(cursor => service.listTrashedDrafts({ type: 'posts', locale, limit: 7,
            ...(cursor === undefined ? {} : { cursor }) }));
          assert.deepEqual(result.rows.map(row => row.id), scoped.map(row => row.id));
          assert.ok(result.rows.every(row => row.locale === locale));
          assert.deepEqual(await repository.listTrashed('posts', { locale, limit: 7 }),
            await service.listTrashedDrafts({ type: 'posts', locale, limit: 7 }));
        }
        assert.deepEqual(await service.listTrashedDrafts({ type: 'posts', locale: 'es' }), { items: [] });
        // Upstream cursors deliberately carry no collection/locale context.
        const boundary = decodeCursor(savedCursor);
        const expectedFrench = seeded.retained.filter(row => row.locale === 'fr' &&
          (row.deletedAt < boundary.orderValue || (row.deletedAt === boundary.orderValue && row.id < boundary.id)));
        const crossLocale = await service.listTrashedDrafts({ type: 'posts', locale: 'fr', cursor: savedCursor });
        assert.deepEqual(ids(crossLocale), expectedFrench.map(row => row.id));
      });

      await t.test('empty cursor is first page; exact terminal and beyond-terminal pages omit continuation', async () => {
        assert.deepEqual(await service.listTrashedDrafts({ type: 'posts', cursor: '' }), first);
        assert.deepEqual(await repository.listTrashed('posts', { cursor: '' }), first);
        const frenchCount = seeded.retained.filter(row => row.locale === 'fr').length;
        const exact = await service.listTrashedDrafts({ type: 'posts', locale: 'fr', limit: frenchCount });
        assert.equal(exact.items.length, frenchCount);
        assert.equal(Object.hasOwn(exact, 'nextCursor'), false);
        assert.deepEqual(await service.listTrashedDrafts({ type: 'posts', cursor: encodeCursor('1900-01-01', '') }), { items: [] });
      });

      await t.test('malformed cursors report INVALID_CURSOR at both repository and service boundaries', async () => {
        for (const cursor of ['not-base64-!!!', Buffer.from('{broken json').toString('base64'),
          Buffer.from(JSON.stringify({ orderValue: 'x', id: 42 })).toString('base64'), 'A'.repeat(5000)]) {
          await assert.rejects(() => repository.listTrashed('posts', { cursor }), { code: 'INVALID_CURSOR' });
          await assert.rejects(() => service.listTrashedDrafts({ type: 'posts', cursor }), { code: 'INVALID_CURSOR' });
        }
      });

      await t.test('saved later page resumes after a storage reopen', async () => {
        await storage.close(); storage = await collectionUpdateStorage(target, directory);
        service = cmsService(storage.database, principal); repository = new DraftRepository(storage.database);
        assert.deepEqual(await service.listTrashedDrafts({ type: 'posts' }), first);
        const resumed = await service.listTrashedDrafts({ type: 'posts', cursor: savedCursor });
        assert.deepEqual(ids(resumed), ordered.slice(50, 100));
        assert.deepEqual(await repository.listTrashed('posts', { cursor: savedCursor }), resumed);
        assert.ok(resumed.nextCursor);
        assert.deepEqual(ids(await service.listTrashedDrafts({ type: 'posts', cursor: resumed.nextCursor })), ordered.slice(100));
      });

      await t.test('restoring a later-page row retains data, rejects stale tokens and survives reopen', async () => {
        const later = seeded.retained[75];
        const trashed = await service.getTrashedDraft({ type: 'posts', id: later.id, locale: later.locale });
        const input = { type: 'posts', id: later.id, locale: later.locale, expected: expected(trashed) };
        const restored = await service.restoreDraft(input);
        assert.deepEqual(restored.data, later.data); assert.equal(restored.locale, later.locale);
        await assert.rejects(() => service.restoreDraft(input), { code: 'CONFLICT' });
        assert.deepEqual(await service.listTrashedDrafts({ type: 'posts' }), first);
        const refreshed = await service.listTrashedDrafts({ type: 'posts', cursor: savedCursor });
        assert.deepEqual(ids(refreshed), ordered.filter(id => id !== later.id).slice(50, 100));
        const remainder = await walk(cursor => service.listTrashedDrafts({ type: 'posts', ...(cursor === undefined ? {} : { cursor }) }));
        assert.deepEqual(remainder.rows.map(row => row.id), ordered.filter(id => id !== later.id));
        await storage.close(); storage = await collectionUpdateStorage(target, directory);
        service = cmsService(storage.database, principal);
        assert.deepEqual(await service.getDraft({ type: 'posts', id: later.id, locale: later.locale }), restored);
        await assert.rejects(() => service.restoreDraft(input), { code: 'CONFLICT' });
        assert.deepEqual(await storage.database.db.selectFrom('_cms_guards').selectAll().execute(), []);
      });
    } finally { await storage.close(); await rm(directory, { recursive: true, force: true }); }
  });
}

test('supplemental cursor wire uses UTF-8 standard base64 and preserves upstream string-only validation', () => {
  for (const [orderValue, id] of [['2026-01-01T00:00:00.000Z', 'entry'], ['日付 🌍', 'é/日本語'], ['', ''],
    ['not a timestamp', 'i'.repeat(129)]]) {
    const cursor = encodeCursor(orderValue, id);
    assert.equal(cursor, Buffer.from(JSON.stringify({ orderValue, id }), 'utf8').toString('base64'));
    assert.deepEqual(decodeCursor(cursor), { orderValue, id });
  }
  const extra = Buffer.from(JSON.stringify({ orderValue: 'x', id: 'y', type: 'other', locale: 'fr' })).toString('base64');
  assert.deepEqual(decodeCursor(extra), { orderValue: 'x', id: 'y' });
});

test('supplemental direct cursor decode rejects empty/malformed/oversized input with a short domain error', () => {
  for (const cursor of ['', 'not-base64-!!!', Buffer.from('{bad json').toString('base64'),
    ...[null, [], 1, { wrong: 'shape' }, { orderValue: 1, id: 'x' }, { orderValue: 'x', id: 42 }]
      .map(value => Buffer.from(JSON.stringify(value)).toString('base64')), 'A'.repeat(5000)]) {
    assert.throws(() => decodeCursor(cursor), error => {
      assert.ok(error instanceof InvalidCursorError);
      assert.equal(error.code, 'INVALID_CURSOR'); assert.ok(error.message.length < 120);
      return true;
    });
  }
  const withinCap = encodeCursor('x'.repeat(3046), '');
  assert.equal(withinCap.length, 4096);
  assert.deepEqual(decodeCursor(withinCap), { orderValue: 'x'.repeat(3046), id: '' });
  assert.throws(() => decodeCursor(encodeCursor('x'.repeat(3048), '')), { code: 'INVALID_CURSOR' });
});
