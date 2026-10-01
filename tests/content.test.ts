import test from 'node:test';
import assert from 'node:assert/strict';
import { contentService, ContentError, type ContentRepository } from '../src/lib/server/content/service.ts';

function fixture() {
  let calls = 0;
  const repository: ContentRepository = {
    async list() { calls++; return []; },
    async get() { calls++; return null; },
    async create(value) { calls++; return { id: 'draft-1', ...value }; },
    async update() { calls++; return null; },
    async delete() { calls++; return false; }
  };
  return { repository, calls: () => calls };
}

test('anonymous callers cannot reach any repository operation', async () => {
  const f = fixture();
  const service = contentService(f.repository, null);
  for (const run of [() => service.list(), () => service.get('a'), () => service.create({}), () => service.update({}), () => service.delete('a')]) {
    await assert.rejects(run, (e) => e instanceof ContentError && e.code === 'unauthenticated');
  }
  assert.equal(f.calls(), 0);
});

test('read capability cannot mutate and invalid input never reaches storage', async () => {
  const f = fixture();
  const reader = contentService(f.repository, { id: 'reader', capabilities: ['content:read'] });
  await assert.rejects(() => reader.create({ title: 'Draft', body: '' }), (e) => e instanceof ContentError && e.code === 'forbidden');
  const writer = contentService(f.repository, { id: 'writer', capabilities: ['content:write'] });
  await assert.rejects(() => writer.create({ title: '   ', body: '' }));
  await assert.rejects(() => writer.update({ id: '', title: 'Draft', body: '' }));
  await assert.rejects(() => writer.delete(''));
  assert.equal(f.calls(), 0);
});

test('valid drafts are normalized and missing records are explicit', async () => {
  const f = fixture();
  const service = contentService(f.repository, { id: 'editor', capabilities: ['content:read', 'content:write'] });
  assert.deepEqual(await service.create({ title: ' Draft ', body: 'Hello' }), { id: 'draft-1', title: 'Draft', body: 'Hello' });
  for (const run of [() => service.get('missing'), () => service.update({ id: 'missing', title: 'Draft', body: '' }), () => service.delete('missing')]) {
    await assert.rejects(run, (e) => e instanceof ContentError && e.code === 'not-found');
  }
});
