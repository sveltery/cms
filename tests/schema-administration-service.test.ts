import test from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'kysely';
import { openSqlite } from '../src/lib/server/database/sqlite.ts';
import { migrateCms } from '../src/lib/server/database/migrations.ts';
import { SchemaRegistry } from '../src/lib/server/database/registry.ts';
import { cmsService } from '../src/lib/server/database/service.ts';

// Original trusted service and CAS supplements, separate from source tests.
test('trusted schema administration reorders and deletes with current collection preconditions', async () => {
  const database = openSqlite(':memory:');
  try {
    await migrateCms(database); const registry = new SchemaRegistry(database);
    const admin = cmsService(database, { id: 'admin', permissions: ['schema:read', 'schema:manage'] });
    assert.equal(typeof admin.reorderCollections, 'function', 'administration exposes collection reorder');
    for (const slug of ['posts', 'pages']) await admin.createCollection({ slug, label: slug });
    const initial = await admin.listCollections();
    const snapshots = initial.map(({slug, version, updatedAt}) => ({ slug, version, updatedAt }));
    await admin.reorderCollections({ slugs: ['posts', 'pages'], expected: snapshots });
    assert.deepEqual((await admin.listCollections()).map(collection => collection.slug), ['posts', 'pages']);
    await assert.rejects(() => admin.reorderCollections({ slugs: ['pages', 'posts'], expected: snapshots }), { code: 'CONFLICT' });
    let definition = await admin.getCollection('posts');
    for (const slug of ['one', 'two']) {
      await admin.addField({ collection: 'posts', expectedSchemaVersion: definition.version, input: { slug, label: slug, type: 'string' } });
      definition = await admin.getCollection('posts');
    }
    const expected = { version: definition.version, updatedAt: definition.updatedAt };
    await admin.reorderFields({ collection: 'posts', fields: ['two', 'one'], expected });
    assert.deepEqual((await admin.getCollection('posts')).fields.map(field => field.slug), ['two', 'one']);
    await admin.deleteField({ collection: 'posts', field: 'one', expected });
    assert.equal(await registry.getField('posts', 'one'), null);
    await sql`INSERT INTO ec_posts(id, two) VALUES('entry','Stored')`.execute(database.db);
    definition = await admin.getCollection('posts');
    await assert.rejects(() => admin.deleteCollection({ collection: 'posts', expected: {version:definition.version,updatedAt:definition.updatedAt} }), { code: 'COLLECTION_NOT_EMPTY' });
    assert.equal((await sql`SELECT two FROM ec_posts WHERE id='entry'`.execute(database.db)).rows.length, 1);
    await admin.deleteCollection({ collection: 'posts', expected: {version:definition.version,updatedAt:definition.updatedAt}, force: true });
    assert.equal(await registry.getCollection('posts'), null);
  } finally { await database.close(); }
});
test('schema administration denies untrusted and nonmanager identities before parsing inputs', async () => {
  const database = openSqlite(':memory:');
  try {
    await migrateCms(database);
    for (const principal of [null, {id:'reader',permissions:['schema:read']}] as const) {
      const service = cmsService(database, principal);
      for (const name of ['reorderCollections','reorderFields','deleteField','deleteCollection'] as const) {
        assert.equal(typeof service[name], 'function', `registered service ${name}`);
        await assert.rejects(() => service[name]({}), {code:principal ? 'FORBIDDEN' : 'UNAUTHENTICATED'});
      }
    }
  } finally { await database.close(); }
});
