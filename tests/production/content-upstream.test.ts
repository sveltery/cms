// Adapted scalar assertions from EmDash 1.1.0 at 913cb1b.
// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// Exact source IDs, fixture adaptations, and red/green evidence: docs/content-remote-ports.json.
import { beforeEach, afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'kysely';
import { persistedRemotes, fields } from '../helpers/persisted-remotes.ts';

describe('registered remote ports of EmDash scalar repository assertions', () => {
  let harness: Awaited<ReturnType<typeof persistedRemotes>>;
  beforeEach(async () => { harness = await persistedRemotes(); });
  afterEach(async () => { await harness.close(); });
  async function created(data = { title: 'Test Post' }, extra = {}) {
    const result = await harness.mutate('createContent', { collection: 'post', ...fields(data), ...extra });
    return harness.query('getContent', { collection: 'post', id: result._.result.id });
  }
  it('should create content with minimal data [source:58]', async () => {
    const content = await created();
    assert.ok(content.id);
    assert.equal(content.type, 'post');
    assert.deepEqual(content.data, { title: 'Test Post' });
    assert.equal(content.status, 'draft');
    assert.ok(content.createdAt);
    assert.ok(content.updatedAt);
  });
  it('should allow null slug [source:147]', async () => {
    const content = await created({ title: 'No slug' });
    assert.equal(content.slug, null);
  });
  it('should default status to draft [source:157]', async () => {
    assert.equal((await created({ title: 'Test' })).status, 'draft');
  });
  it('should find content by ID [source:209]', async () => {
    const item = await harness.repository.create({ type: 'post', data: { title: 'Test' } }, 'user_author');
    const found = await harness.query('getContent', { collection: 'post', id: item.id });
    assert.notEqual(found, null);
    assert.equal(found.id, item.id);
    assert.deepEqual(found.data, item.data);
  });
  it('should update content data [source:880]', async () => {
    const item = await harness.repository.create({ type: 'post', data: { title: 'Original' } }, 'user_author');
    const read = await harness.query('getContent', { collection: 'post', id: item.id });
    const result = await harness.mutate('updateContent', { collection: 'post', id: item.id, _rev: read._rev, ...fields({ title: 'Updated' }) });
    const updated = await harness.query('getContent', { collection: 'post', id: result._.result.id });
    assert.equal(updated.data.title, 'Updated');
    assert.equal(updated.id, item.id);
  });
  it('should update slug [source:908]', async () => {
    const item = await harness.repository.create({ type: 'post', slug: 'old-slug', data: { title: 'Test' } }, 'user_author');
    const read = await harness.query('getContent', { collection: 'post', id: item.id });
    const result = await harness.mutate('updateContent', { collection: 'post', id: item.id, _rev: read._rev, slug: 'new-slug' });
    const updated = await harness.query('getContent', { collection: 'post', id: result._.result.id });
    assert.equal(updated.slug, 'new-slug');
  });
  it('should update updatedAt timestamp [source:1026]', async () => {
    const item = await harness.repository.create({ type: 'post', data: { title: 'Test' } }, 'user_author');
    const read = await harness.query('getContent', { collection: 'post', id: item.id });
    await new Promise(resolve => setTimeout(resolve, 10));
    const result = await harness.mutate('updateContent', { collection: 'post', id: item.id, _rev: read._rev, ...fields({ title: 'Updated' }) });
    const updated = await harness.query('getContent', { collection: 'post', id: result._.result.id });
    assert.ok(updated.updatedAt > item.updatedAt);
  });
  it('should set deleted_at timestamp [source:1088]', async () => {
    const item = await harness.repository.create({ type: 'post', data: { title: 'Test' } }, 'user_author');
    const read = await harness.query('getContent', { collection: 'post', id: item.id });
    await harness.mutate('deleteContent', { collection: 'post', id: item.id, _rev: read._rev });
    const result = await sql<{ deleted_at: string | null }>`SELECT deleted_at FROM ec_post WHERE id = ${item.id}`.execute(harness.database.db);
    assert.notEqual(result.rows[0]?.deleted_at, undefined);
    assert.notEqual(result.rows[0]?.deleted_at, null);
  });
});
