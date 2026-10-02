// Selected assertions from EmDash 1.1.0, immutable 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e.
// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// registry.test.ts:234,248,336. Fixture/runner substitutions are documented separately.
import assert from 'node:assert/strict';

export interface CollectionUpdateFixture {
  seed(input: { slug: string; label: string }): Promise<unknown>;
  update(slug: string, input: Record<string, unknown>): Promise<{
    label: string; description?: string | null; supports: string[]; updatedAt: string;
  }>;
  backdate(slug: string): Promise<void>;
  error: new (...args: never[]) => Error;
}

export const collectionUpdateCases = [
  { line: 234, title: 'should update a collection', async run(fixture: CollectionUpdateFixture) {
    await fixture.seed({ slug: 'posts', label: 'Posts' });
    const updated = await fixture.update('posts', {
      label: 'Blog Posts', description: 'All blog posts', supports: ['drafts']
    });
    assert.equal(updated.label, 'Blog Posts');
    assert.equal(updated.description, 'All blog posts');
    assert.deepEqual(updated.supports, ['drafts']);
  } },
  { line: 248, title: 'touches updatedAt for an empty update', async run(fixture: CollectionUpdateFixture) {
    await fixture.seed({ slug: 'posts', label: 'Posts' });
    await fixture.backdate('posts');
    const updated = await fixture.update('posts', {});
    assert.notEqual(updated.updatedAt, '2000-01-01T00:00:00.000Z');
  } },
  { line: 336, title: 'should throw when updating non-existent collection', async run(fixture: CollectionUpdateFixture) {
    await assert.rejects(() => fixture.update('nonexistent', { label: 'Test' }), fixture.error);
  } }
];
