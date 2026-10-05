import assert from 'node:assert/strict';
import { test } from 'vitest';
import { openSqlite } from '../../src/lib/server/database/sqlite.ts';
import { migrateCms } from '../../src/lib/server/database/migrations.ts';
import { SchemaRegistry } from '../../src/lib/server/database/registry.ts';
import { OptionsRepository } from '../../src/lib/server/options/repository.ts';
import { canonicalSourceDatabase } from '../../src/lib/server/canonical-storage/namespace.ts';

async function readSeams(): Promise<Record<string, any>> {
  const path = '../../src/lib/server/seo/read.ts';
  try { return await import(path); }
  catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
    return {};
  }
}

test('SEO settings read real site keys and leave absent settings undefined', async () => {
  const database = openSqlite(':memory:');
  try {
    await migrateCms(database);
    const options = new OptionsRepository(canonicalSourceDatabase(database));
    await options.set('site:title', 'Stored site');
    await options.set('site:url', 'https://example.com');
    await options.set('other:url', 'https://unrelated.invalid');
    const api = await readSeams();
    assert.equal(typeof api.getSiteSettingsWithDb, 'function');
    assert.deepEqual(await api.getSiteSettingsWithDb(database.db), {
      title: 'Stored site', url: 'https://example.com'
    });
  } finally { await database.close(); }
});

test('SEO collection info reuses the stored Registry flag and metadata', async () => {
  const database = openSqlite(':memory:');
  try {
    await migrateCms(database);
    const registry = new SchemaRegistry(database);
    const stored = await registry.createCollection({ slug: 'post', label: 'Posts', supports: ['seo'], urlPattern: '/blog/{slug}' });
    const api = await readSeams();
    assert.equal(typeof api.getCollectionInfoWithDb, 'function');
    assert.deepEqual(await api.getCollectionInfoWithDb(database.db, 'post'), stored);
    assert.equal(await api.getCollectionInfoWithDb(database.db, 'missing'), null);
  } finally { await database.close(); }
});
