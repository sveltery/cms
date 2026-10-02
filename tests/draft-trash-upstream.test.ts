// Assertion adaptations from EmDash 1.1.0 immutable
// 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e:
// packages/core/tests/integration/content/trash-locale-filter.test.ts:57/:65/:75.
// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// Draft-only fixtures omit upstream translationOf and handler success envelopes.
// Three selected value assertions, not complete leaf/published/revision parity.
import test from 'node:test';
import assert from 'node:assert/strict';
import { collectionUpdateStorage } from './helpers/collection-update-fixture.ts';
import { migrateCms } from '../src/lib/server/database/migrations.ts';
import { cmsService } from '../src/lib/server/database/service.ts';
for (const target of ['Node', 'D1'] as const) {
  test(`${target}: adapted trash-locale-filter.test.ts:57/65/75 value assertions`, { timeout: 30000 }, async () => {
    const storage = await collectionUpdateStorage(target);
    try {
      await migrateCms(storage.database);
      const service = cmsService(storage.database, { id: 'author', permissions: ['schema:manage', 'content:create', 'content:read', 'content:read_drafts', 'content:delete_own'] });
      await service.createCollection({ slug: 'posts', label: 'Posts', labelSingular: 'Post' });
      await service.addField({ collection: 'posts', expectedSchemaVersion: 1, input: { slug: 'title', label: 'Title', type: 'string' } });
      for (const [locale, slug, title] of [['en', 'hello-en', 'Hello'], ['fr', 'hello-fr', 'Bonjour'], ['de', 'hallo-de', 'Hallo']]) {
        const row = await service.createDraft({ type: 'posts', locale, slug, data: { title } });
        await service.deleteDraft({ type: 'posts', id: row.id, locale, expected: { version: row.version, updatedAt: row.updatedAt } });
      }
      const scoped = await service.listTrashedDrafts({ type: 'posts', locale: 'fr' });
      assert.deepEqual(scoped.items.map(item => item.slug), ['hello-fr']);
      const all = await service.listTrashedDrafts({ type: 'posts' });
      assert.deepEqual(new Set(all.items.map(item => item.slug)), new Set(['hello-en', 'hello-fr', 'hallo-de']));
      const de = await service.listTrashedDrafts({ type: 'posts', locale: 'de' });
      assert.equal(de.items[0]?.locale, 'de');
    } finally { await storage.close(); }
  });
}
