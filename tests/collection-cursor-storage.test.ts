// Supplemental local pagination/persistence checks; no upstream leaf credit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Miniflare } from 'miniflare';
import { openSqlite } from '../src/lib/server/database/sqlite.ts';
import { openD1 } from '../src/lib/server/database/d1.ts';
import { migrateCms } from '../src/lib/server/database/migrations.ts';
import { SchemaRegistry } from '../src/lib/server/database/registry.ts';
import { DraftRepository } from '../src/lib/server/database/entries.ts';
import { cmsService } from '../src/lib/server/database/service.ts';

for (const target of ['Node', 'D1'] as const) {
  test(`${target}: 103 persisted drafts paginate without duplicates after storage reopens`, { timeout: 30_000 }, async () => {
    const directory = await mkdtemp(join(tmpdir(), 'cms-cursor-storage-'));
    let runtime: Miniflare | undefined;
    const open = async () => {
      if (target === 'Node') return openSqlite(join(directory, 'content.sqlite'));
      runtime = new Miniflare({ modules: true, script: 'export default { fetch() { return new Response("fixture") } }',
        compatibilityDate: '2026-05-07', host: '127.0.0.1', port: 0, cf: false,
        d1Databases: { DB: 'cms-cursor' }, d1Persist: directory });
      return openD1(await runtime.getD1Database('DB'));
    };
    let database = await open();
    try {
      await migrateCms(database);
      const registry = new SchemaRegistry(database);
      for (const slug of ['post', 'empty']) {
        await registry.createCollection({ slug, label: slug });
        await registry.createField(slug, { slug: 'title', label: 'Title', type: 'string' });
      }
      const repository = new DraftRepository(database);
      const expected = [];
      for (let index = 0; index < 103; index++) expected.push((await repository.create({ type: 'post', data: { title: `Draft ${index}` } }, 'author')).id);
      const first = await repository.list('post');
      assert.equal(first.items.length, 50);
      assert.ok(first.nextCursor);
      await database.close();
      await runtime?.dispose();
      database = await open();
      const service = cmsService(database, { id: 'author', permissions: ['content:read', 'content:read_drafts'] });
      const second = await service.listDrafts({ type: 'post', cursor: first.nextCursor });
      assert.equal(second.items.length, 50);
      assert.ok(second.nextCursor);
      const third = await service.listDrafts({ type: 'post', cursor: second.nextCursor });
      assert.equal(third.items.length, 3);
      assert.equal(third.nextCursor, undefined);
      const ids = [...first.items, ...second.items, ...third.items].map(item => item.id);
      assert.equal(new Set(ids).size, 103);
      assert.deepEqual(ids.toSorted(), expected.toSorted());
      assert.deepEqual(await service.listDrafts({ type: 'empty' }), { items: [] });
      await assert.rejects(() => service.listDrafts({ type: 'empty', cursor: first.nextCursor }), { code: 'VALIDATION_ERROR' });
      await assert.rejects(() => cmsService(database, null).listDrafts({ type: 'post', cursor: first.nextCursor }), { code: 'UNAUTHENTICATED' });
      await assert.rejects(() => cmsService(database, { id: 'subscriber', permissions: ['content:read'] }).listDrafts({ type: 'post', cursor: first.nextCursor }), { code: 'FORBIDDEN' });
    } finally { await database.close(); await runtime?.dispose(); await rm(directory, { recursive: true, force: true }); }
  });
}
