// Bounded assertion ports from EmDash 1.1.0 runtime/manifest-build.test.ts.
// MIT Copyright 2026 Cloudflare Inc.; see notices/emdash-MIT.txt and docs/session-composition-ports.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import { openSqlite } from '../src/lib/server/database/sqlite.ts';
import { migrateCms } from '../src/lib/server/database/migrations.ts';
import { SchemaRegistry, MAX_COLLECTIONS, MAX_FIELDS } from '../src/lib/server/database/registry.ts';
import { cmsService } from '../src/lib/server/database/service.ts';
import { editorManifest } from '../src/lib/server/content/manifest.ts';
const author = { id: 'author', permissions: ['content:read', 'content:read_drafts', 'content:create'] as const };
async function fixture() { const database = openSqlite(':memory:'); await migrateCms(database); return { database, registry: new SchemaRegistry(database) }; }

test('source: includes manual collections that have no fields', async () => {
  const { database, registry } = await fixture();
  try {
    await registry.createCollection({ slug: 'links', label: 'Links', labelSingular: 'Link' });
    const manifest = await editorManifest(database, author);
    assert.ok(manifest.collections.links);
    assert.deepEqual(manifest.collections.links.fields, {});
  } finally { await database.close(); }
});

test('source subset: forwards declared validation on scalar fields and omits absent validation', async () => {
  const { database, registry } = await fixture();
  try {
    await registry.createCollection({ slug: 'posts', label: 'Posts' });
    await registry.createField('posts', { slug: 'title', label: 'Title', type: 'string', validation: { minLength: 3, maxLength: 80 } });
    await registry.createField('posts', { slug: 'excerpt', label: 'Excerpt', type: 'text', validation: { maxLength: 160 } });
    await registry.createField('posts', { slug: 'subtitle', label: 'Subtitle', type: 'string' });
    const fields = (await editorManifest(database, author)).collections.posts.fields;
    assert.deepEqual(fields.title.validation, { minLength: 3, maxLength: 80 });
    assert.deepEqual(fields.excerpt.validation, { maxLength: 160 });
    assert.equal(fields.subtitle.validation, undefined);
    assert.equal(fields.title.kind, 'string'); assert.equal(fields.excerpt.kind, 'richText');
  } finally { await database.close(); }
});

test('source: reflects schema mutations immediately with no cross-runtime cache', async () => {
  const { database, registry } = await fixture();
  try {
    await registry.createCollection({ slug: 'posts', label: 'Posts', labelSingular: 'Post' });
    const runtimeA = () => editorManifest(database, author); const runtimeB = () => editorManifest(database, author);
    assert.deepEqual(Object.keys((await runtimeA()).collections), ['posts']);
    assert.deepEqual(Object.keys((await runtimeB()).collections), ['posts']);
    await registry.createCollection({ slug: 'pages', label: 'Pages', labelSingular: 'Page' });
    assert.deepEqual(Object.keys((await runtimeA()).collections).toSorted(), ['pages', 'posts']);
    assert.deepEqual(Object.keys((await runtimeB()).collections).toSorted(), ['pages', 'posts']);
  } finally { await database.close(); }
});

test('manifest requires draft-read before querying; administrative schema policy is unchanged', async () => {
  const database = openSqlite(':memory:');
  try {
    await assert.rejects(() => editorManifest(database, null), { code: 'UNAUTHENTICATED' });
    await assert.rejects(() => editorManifest(database, { id: 'subscriber', permissions: ['content:read'] }), { code: 'FORBIDDEN' });
    await assert.rejects(() => editorManifest(database, { id: 'forged', permissions: ['content:create'] }), { code: 'FORBIDDEN' });
    await assert.rejects(() => cmsService(database, author).listCollections(), { code: 'FORBIDDEN' });
    await assert.rejects(() => cmsService(database, author).getCollection('posts'), { code: 'FORBIDDEN' });
  } finally { await database.close(); }
});

test('least-disclosure projection excludes storage/admin/default/content values and respects registry bounds', async () => {
  const { database, registry } = await fixture();
  try {
    await registry.createCollection({ slug: 'posts', label: 'Posts', description: 'Internal schema description' });
    await registry.createField('posts', { slug: 'title', label: 'Title', type: 'string', unique: true, defaultValue: 'Internal default' });
    const collection = (await editorManifest(database, author)).collections.posts;
    assert.deepEqual(Object.keys(collection).sort(), ['fields', 'label', 'labelSingular', 'supports']);
    assert.deepEqual(Object.keys(collection.fields.title).sort(), ['id', 'kind', 'label', 'required']);
    assert.doesNotMatch(JSON.stringify(collection), /Internal|columnType|collectionId|createdAt|version|unique/);
    for (let i = 1; i < MAX_COLLECTIONS; i++) await registry.createCollection({ slug: `coll_${i}`, label: `Coll ${i}` });
    for (let i = 1; i < MAX_FIELDS; i++) await registry.createField('posts', { slug: `field_${i}`, label: `Field ${i}`, type: 'string' });
    const manifest = await editorManifest(database, author);
    assert.equal(Object.keys(manifest.collections).length, MAX_COLLECTIONS);
    assert.equal(Object.keys(manifest.collections.posts.fields).length, MAX_FIELDS);
  } finally { await database.close(); }
});
