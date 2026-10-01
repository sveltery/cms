// Ownership assertion adaptations from EmDash 1.1.0 (913cb1b).
// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// Published upstream fixtures become drafts; these are partial policy ports, not lifecycle parity.
import { beforeEach, afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'kysely';
import { persistedRemotes, fields } from '../helpers/persisted-remotes.ts';

describe('registered remote ownership policy adaptations', () => {
  let harness: Awaited<ReturnType<typeof persistedRemotes>>;
  beforeEach(async () => { harness = await persistedRemotes(); });
  afterEach(async () => { await harness.close(); });
  async function update(owner: string | null, actor: string) {
    const item = await harness.repository.create({ type: 'post', data: { title: 'Seeded Post' } }, owner || 'seed');
    if (!owner) await sql`UPDATE ec_post SET author_id = ${owner} WHERE id = ${item.id}`.execute(harness.database.db);
    const current = await harness.query('getContent', { collection: 'post', id: item.id }, actor);
    return harness.remote('updateContent', actor, { collection: 'post', id: item.id, _rev: current._rev, ...fields({ title: 'Updated' }) });
  }
  it('AUTHOR can update their own content (authorId matches)', async () => {
    const result = await update('user_author', 'author');
    assert.equal(result.type, 'result');
    assert.equal(JSON.parse(JSON.stringify(result)).status, undefined);
  });
  it("AUTHOR cannot update someone else's content (authorId set to other user)", async () => {
    const result = await update('user_someone_else', 'author');
    assert.equal(result.type, 'error');
    assert.equal(result.status, 403);
  });
  it("EDITOR can update anyone's content (any-permission)", async () => {
    assert.equal((await update('user_someone_else', 'editor')).type, 'result');
  });
  it('AUTHOR cannot update content with null authorId (no ownership claim)', async () => {
    const result = await update(null, 'author');
    assert.equal(result.type, 'error');
    assert.equal(result.status, 403);
    assert.doesNotMatch(result.error.message, /no.*authorId|content has no authorId/i);
    assert.equal(result.error.code, 'INSUFFICIENT_PERMISSIONS');
  });
  it('EDITOR can update content with null authorId', async () => {
    assert.equal((await update(null, 'editor')).type, 'result');
  });
});
