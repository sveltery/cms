// Adapted from EmDash 1.0.1 (0e8977c), Copyright 2026 Cloudflare Inc.
// MIT; see notices/emdash-LICENSE and docs/database-parity.md for source mapping.
import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'kysely';
import { openSqlite } from '../src/lib/server/database/sqlite.ts';
import { migrateCms } from '../src/lib/server/database/migrations.ts';
import { SchemaRegistry } from '../src/lib/server/database/registry.ts';
import { DraftRepository } from '../src/lib/server/database/entries.ts';
import type { CmsDatabase } from '../src/lib/server/database/contract.ts';

describe('ported EmDash SchemaRegistry assertions', () => {
  let database: CmsDatabase;
  let registry: SchemaRegistry;
  beforeEach(async () => { database = openSqlite(':memory:'); await migrateCms(database); registry = new SchemaRegistry(database); });
  afterEach(async () => { await database.close(); });

  it('should create a collection', async () => {
    const collection = await registry.createCollection({ slug: 'posts', label: 'Blog Posts', labelSingular: 'Post', supports: ['drafts', 'revisions'] });
    assert.equal(collection.slug, 'posts');
    assert.equal(collection.label, 'Blog Posts');
    assert.equal(collection.labelSingular, 'Post');
    assert.deepEqual(collection.supports, ['drafts', 'revisions']);
    assert.equal(collection.source, 'manual');
    assert.ok(collection.id);
  });
  it("F14: defaults supports to ['drafts', 'revisions'] when undefined", async () => {
    const collection = await registry.createCollection({ slug: 'default_supports', label: 'Default Supports' });
    assert.deepEqual(collection.supports.toSorted(), ['drafts', 'revisions'].toSorted());
  });
  it('F14: preserves explicit empty supports array (opt-out)', async () => {
    const collection = await registry.createCollection({ slug: 'no_supports', label: 'No Supports', supports: [] });
    assert.deepEqual(collection.supports, []);
  });
  it('should create the content table when creating a collection', async () => {
    await registry.createCollection({ slug: 'articles', label: 'Articles' });
    const result = await sql`INSERT INTO ec_articles (id, slug, status) VALUES ('test-id', 'test-slug', 'draft')`.execute(database.db);
    assert.ok(result);
  });
  it('rejects an unregistered content table with a structured conflict', async () => {
    await sql`CREATE TABLE ec_orphaned (id TEXT PRIMARY KEY)`.execute(database.db);
    await assert.rejects(() => registry.createCollection({ slug: 'orphaned', label: 'Orphaned' }), { code: 'COLLECTION_TABLE_ORPHANED' });
  });
  it('should list collections', async () => {
    await registry.createCollection({ slug: 'posts', label: 'Posts' });
    await registry.createCollection({ slug: 'pages', label: 'Pages' });
    const collections = await registry.listCollections();
    assert.equal(collections.length, 2);
    assert.deepEqual(collections.map(c => c.slug), ['pages', 'posts']);
  });
  it('should get a collection by slug', async () => {
    await registry.createCollection({ slug: 'products', label: 'Products', description: 'Store products' });
    const collection = await registry.getCollection('products');
    assert.notEqual(collection, null);
    assert.equal(collection?.slug, 'products');
    assert.equal(collection?.description, 'Store products');
  });
  it('should return null for non-existent collection', async () => {
    assert.equal(await registry.getCollection('nonexistent'), null);
  });
  it('should throw when creating duplicate collection', async () => {
    await registry.createCollection({ slug: 'posts', label: 'Posts' });
    await assert.rejects(() => registry.createCollection({ slug: 'posts', label: 'Posts' }));
  });
  it('should add column to content table when creating field', async () => {
    await registry.createCollection({ slug: 'posts', label: 'Posts' });
    await registry.createField('posts', { slug: 'title', label: 'Title', type: 'string' });
    await sql`INSERT INTO ec_posts (id, title) VALUES ('test-id', 'Test Title')`.execute(database.db);
    const row = (await sql<{ title: string }>`SELECT * FROM ec_posts`.execute(database.db)).rows[0];
    assert.equal(row.title, 'Test Title');
  });
  it('should get a field by slug', async () => {
    await registry.createCollection({ slug: 'posts', label: 'Posts' });
    await registry.createField('posts', { slug: 'title', label: 'Title', type: 'string', validation: { minLength: 1, maxLength: 100 } });
    const field = await registry.getField('posts', 'title');
    assert.notEqual(field, null);
    assert.deepEqual(field?.validation, { minLength: 1, maxLength: 100 });
  });
  it('should reject reserved field slugs', async () => {
    await registry.createCollection({ slug: 'posts', label: 'Posts' });
    await assert.rejects(() => registry.createField('posts', { slug: 'id', label: 'ID', type: 'string' }));
    await assert.rejects(() => registry.createField('posts', { slug: 'created_at', label: 'Created', type: 'text' }));
  });
});

describe('ported EmDash ContentRepository draft assertions', () => {
  let database: CmsDatabase;
  let repository: DraftRepository;
  beforeEach(async () => {
    database = openSqlite(':memory:'); await migrateCms(database);
    const registry = new SchemaRegistry(database);
    for (const slug of ['post', 'page']) {
      await registry.createCollection({ slug, label: slug });
      await registry.createField(slug, { slug: 'title', label: 'Title', type: 'string' });
    }
    repository = new DraftRepository(database);
  });
  afterEach(async () => { await database.close(); });

  it('should create content with minimal data', async () => {
    const content = await repository.create({ type: 'post', data: { title: 'Test Post' } }, 'server-author');
    assert.ok(content.id);
    assert.equal(content.type, 'post');
    assert.deepEqual(content.data, { title: 'Test Post' });
    assert.equal(content.status, 'draft');
    assert.ok(content.createdAt);
    assert.ok(content.updatedAt);
  });
  it('should throw error for duplicate type+slug', async () => {
    await repository.create({ type: 'post', slug: 'duplicate-slug', data: { title: 'First' } }, 'author');
    await assert.rejects(() => repository.create({ type: 'post', slug: 'duplicate-slug', data: { title: 'Second' } }, 'author'));
  });
  it('should allow same slug for different types', async () => {
    await repository.create({ type: 'post', slug: 'same-slug', data: { title: 'Post' } }, 'author');
    await repository.create({ type: 'page', slug: 'same-slug', data: { title: 'Page' } }, 'author');
  });
  it('should allow null slug', async () => {
    const content = await repository.create({ type: 'post', slug: null, data: { title: 'No slug' } }, 'author');
    assert.equal(content.slug, null);
  });
  it('should generate unique ID', async () => {
    const first = await repository.create({ type: 'post', data: { title: 'First' } }, 'author');
    const second = await repository.create({ type: 'post', data: { title: 'Second' } }, 'author');
    assert.notEqual(first.id, second.id);
  });
  it('should find content by ID', async () => {
    const created = await repository.create({ type: 'post', data: { title: 'Test' } }, 'author');
    const found = await repository.findById('post', created.id);
    assert.notEqual(found, null);
    assert.equal(found?.id, created.id);
    assert.deepEqual(found?.data, created.data);
  });
  it('should return null for non-existent ID', async () => {
    assert.equal(await repository.findById('post', 'non-existent-id'), null);
  });
  it("should return null when type doesn't match", async () => {
    const created = await repository.create({ type: 'post', data: { title: 'Test' } }, 'author');
    assert.equal(await repository.findById('page', created.id), null);
  });
});
