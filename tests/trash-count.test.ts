// Bounded draft-only adaptation informed by EmDash 1.1.0, immutable
// 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e:
// repositories/content.ts:1770 and integration/content/trash-locale-filter.test.ts:83.
// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// Only the two count values 1/3 below adapt the upstream declaration's expectations.
// The translationOf fixture and handler envelope are unsupported here: zero complete
// upstream declarations. All other assertions are supplemental original evidence.
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
import type { CmsDatabase, DraftEntry } from '../src/lib/server/database/contract.ts';

const principal: ServerPrincipal = { id: 'trash-reader', permissions: [
  'content:create', 'content:read', 'content:read_drafts', 'content:edit_any', 'content:delete_any'
] };
const expected = (row: DraftEntry) => ({ version: row.version, updatedAt: row.updatedAt });

async function setup(database: CmsDatabase) {
  await migrateCms(database);
  const registry = new SchemaRegistry(database);
  await registry.createCollection({ slug: 'posts', label: 'Posts' });
  await registry.createField('posts', { slug: 'title', label: 'Title', type: 'string' });
  return { service: cmsService(database, principal), repository: new DraftRepository(database) };
}

for (const target of ['Node', 'D1'] as const) {
  test(`${target}: empty trash counts zero; adapted upstream locale count values are 1 scoped/3 all`, { timeout: 30_000 }, async () => {
    const storage = await collectionUpdateStorage(target);
    try {
      const { service, repository } = await setup(storage.database);
      assert.equal(await service.countTrashedDrafts({ type: 'posts' }), 0);
      assert.equal(await repository.countTrashed('posts', { locale: 'fr' }), 0);
      for (const [locale, slug, title] of [
        ['en', 'hello-en', 'Hello'], ['fr', 'hello-fr', 'Bonjour'], ['de', 'hallo-de', 'Hallo']
      ]) {
        // Local independent rows deliberately omit the unsupported translationOf.
        const row = await service.createDraft({ type: 'posts', locale, slug, data: { title } });
        await service.deleteDraft({ type: 'posts', id: row.id, locale, expected: expected(row) });
      }
      // Adapted values from upstream trash-locale-filter.test.ts:87/88; no envelope credit.
      assert.equal(await service.countTrashedDrafts({ type: 'posts', locale: 'en' }), 1);
      assert.equal(await service.countTrashedDrafts({ type: 'posts' }), 3);
      assert.equal(await repository.countTrashed('posts'), 3);
      assert.equal(await repository.countTrashed('posts', { locale: 'fr' }), 1);
      assert.equal(await service.countTrashedDrafts({ type: 'posts', locale: 'es' }), 0);
      await service.createDraft({ type: 'posts', locale: 'en', data: { title: 'Active excluded' } });
      assert.equal(await service.countTrashedDrafts({ type: 'posts' }), 3);
      assert.equal(await service.countTrashedDrafts({ type: 'posts', locale: undefined }), 3);
    } finally { await storage.close(); }
  });

  test(`${target}: counts exceed page caps, change after trash/restore and persist across reopen`, { timeout: 90_000 }, async () => {
    const directory = await mkdtemp(join(tmpdir(), `cms-trash-count-${target.toLowerCase()}-`));
    let storage = await collectionUpdateStorage(target, directory);
    try {
      let { service, repository } = await setup(storage.database);
      let first: DraftEntry | undefined;
      for (let index = 0; index < 103; index++) {
        const locale = ['en', 'fr', 'de'][index % 3];
        const row = await service.createDraft({ type: 'posts', locale, data: { title: `Deleted ${index}` } });
        first ??= row;
        await service.deleteDraft({ type: 'posts', id: row.id, locale, expected: expected(row) });
      }
      const active = await service.createDraft({ type: 'posts', data: { title: 'Active until trashed' } });
      assert.equal(await service.countTrashedDrafts({ type: 'posts' }), 103);
      assert.equal(await repository.countTrashed('posts'), 103);
      assert.equal((await service.listTrashedDrafts({ type: 'posts' })).items.length, 50);
      const capped = await service.listTrashedDrafts({ type: 'posts', limit: 1000 });
      assert.equal(capped.items.length, 100);
      assert.ok(capped.nextCursor);
      assert.equal((await service.listTrashedDrafts({ type: 'posts', cursor: capped.nextCursor })).items.length, 3);
      assert.equal(await service.countTrashedDrafts({ type: 'posts' }), 103);
      assert.equal(await service.countTrashedDrafts({ type: 'posts', locale: 'en' }), 35);
      assert.equal(await service.countTrashedDrafts({ type: 'posts', locale: 'fr' }), 34);
      assert.equal(await service.countTrashedDrafts({ type: 'posts', locale: 'de' }), 34);

      await storage.close(); storage = await collectionUpdateStorage(target, directory);
      service = cmsService(storage.database, principal); repository = new DraftRepository(storage.database);
      assert.equal(await repository.countTrashed('posts'), 103);
      assert.equal(await service.countTrashedDrafts({ type: 'posts', locale: 'en' }), 35);
      const trashed = await service.getTrashedDraft({ type: 'posts', id: first!.id, locale: 'en' });
      const restored = await service.restoreDraft({ type: 'posts', id: trashed.id, locale: 'en', expected: expected(trashed) });
      assert.equal(await service.countTrashedDrafts({ type: 'posts' }), 102);
      assert.equal(await service.countTrashedDrafts({ type: 'posts', locale: 'en' }), 34);
      await service.deleteDraft({ type: 'posts', id: active.id, expected: expected(active) });
      assert.equal(await service.countTrashedDrafts({ type: 'posts' }), 103);
      await storage.close(); storage = await collectionUpdateStorage(target, directory);
      service = cmsService(storage.database, principal);
      assert.equal(await service.countTrashedDrafts({ type: 'posts' }), 103);
      assert.equal(await service.countTrashedDrafts({ type: 'posts', locale: 'en' }), 35);
      assert.deepEqual(await service.getDraft({ type: 'posts', id: restored.id }), restored);
    } finally { await storage.close(); await rm(directory, { recursive: true, force: true }); }
  });

  test(`${target}: count predicate retains the draft-only bound on synthetic mixed statuses`, { timeout: 30_000 }, async () => {
    const storage = await collectionUpdateStorage(target);
    try {
      await migrateCms(storage.database);
      const database = storage.database;
      const date = '2026-01-01T00:00:00.000Z';
      // Product tables remain draft-only. This disposable unsupported-status
      // fixture probes exclusions without rebuilding a table or adding lifecycle.
      await database.db.insertInto('_cms_collections').values({
        id: 'synthetic-mixed-count', slug: 'mixed', label: 'Synthetic mixed statuses', label_singular: null,
        description: null, supports: '["drafts"]', source: 'manual', version: 1,
        created_at: date, updated_at: date
      }).execute();
      await sql`CREATE TABLE ec_mixed (id TEXT PRIMARY KEY, status TEXT, locale TEXT, deleted_at TEXT)`.execute(database.db);
      for (const [id, status, deletedAt, locale] of [
        ['trashed-en', 'draft', date, 'en'], ['trashed-fr', 'draft', date, 'fr'],
        ['active', 'draft', null, 'en'], ['trashed-published', 'published', date, 'en'],
        ['trashed-scheduled', 'scheduled', date, 'fr']
      ] as const) {
        await sql`INSERT INTO ec_mixed (id, status, locale, deleted_at)
          VALUES (${id}, ${status}, ${locale}, ${deletedAt})`.execute(database.db);
      }
      const service = cmsService(database, principal);
      assert.equal(await service.countTrashedDrafts({ type: 'mixed' }), 2);
      assert.equal(await service.countTrashedDrafts({ type: 'mixed', locale: 'en' }), 1);
      assert.equal(await new DraftRepository(database).countTrashed('mixed', { locale: 'fr' }), 1);
    } finally { await storage.close(); }
  });

  test(`${target}: count input is scoped and strict, and reads require both existing permissions`, { timeout: 30_000 }, async () => {
    const storage = await collectionUpdateStorage(target);
    try {
      const { service, repository } = await setup(storage.database);
      for (const input of [null, {}, { type: '../posts' }, { type: 'posts', locale: '' },
        { type: 'posts', locale: null }, { type: 'posts', locale: 'en;DROP' },
        { type: 'posts', limit: 1 }, { type: 'posts', cursor: '' },
        { type: 'posts', principal: { id: 'admin' } }]) {
        await assert.rejects(() => service.countTrashedDrafts(input), { code: 'VALIDATION_ERROR' });
      }
      await assert.rejects(() => repository.countTrashed('posts', { locale: '' }), { code: 'VALIDATION_ERROR' });
      await assert.rejects(() => repository.countTrashed('../posts'), { code: 'VALIDATION_ERROR' });
      await assert.rejects(() => service.countTrashedDrafts({ type: 'missing' }), { code: 'NOT_FOUND' });
      await assert.rejects(() => repository.countTrashed('missing'), { code: 'NOT_FOUND' });
      // Closed storage guarantees denied calls never proceed to a database read.
      await storage.database.close();
      for (const denied of [null, { id: 'reader', permissions: [] },
        { id: 'reader', permissions: ['content:read'] },
        { id: 'reader', permissions: ['content:read_drafts'] },
        { id: 'writer', permissions: ['content:edit_any', 'content:delete_any'] }] as (ServerPrincipal | null)[]) {
        const deniedService = cmsService(storage.database, denied);
        const code = denied === null ? 'UNAUTHENTICATED' : 'FORBIDDEN';
        await assert.rejects(() => deniedService.countTrashedDrafts({ type: 'posts' }), { code });
        await assert.rejects(() => deniedService.countTrashedDrafts(null), { code });
      }
    } finally { await storage.close(); }
  });
}
