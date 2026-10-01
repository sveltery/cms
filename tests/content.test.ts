import test from 'node:test';
import assert from 'node:assert/strict';
import { ValiError } from 'valibot';
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
  await assert.rejects(() => writer.create({ title: '   ', body: '' }), ValiError);
  await assert.rejects(() => writer.update({ id: '', title: 'Draft', body: '' }), ValiError);
  await assert.rejects(() => writer.delete(''), ValiError);
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

test('capability checks cover every denied operation before accessing storage', async () => {
  const f = fixture();
  const reader = contentService(f.repository, { id: 'reader', capabilities: ['content:read'] });
  const writer = contentService(f.repository, { id: 'writer', capabilities: ['content:write'] });
  const unprivileged = contentService(f.repository, { id: 'user', capabilities: [] });
  for (const run of [
    () => reader.create({ title: 'Draft', body: '' }),
    () => reader.update({ id: 'a', title: 'Draft', body: '' }),
    () => reader.delete('a'),
    () => writer.list(), () => writer.get('a'),
    () => unprivileged.list(), () => unprivileged.get('a'),
    () => unprivileged.create({ title: 'Draft', body: '' }),
    () => unprivileged.update({ id: 'a', title: 'Draft', body: '' }),
    () => unprivileged.delete('a')
  ]) {
    await assert.rejects(run, (e) => e instanceof ContentError && e.code === 'forbidden');
  }
  assert.equal(f.calls(), 0);
});

test('service limits and unknown input fields protect future non-HTTP callers', async () => {
  const f = fixture();
  const service = contentService(f.repository, { id: 'editor', capabilities: ['content:read', 'content:write'] });
  for (const run of [
    () => service.get(1), () => service.get('x'.repeat(129)),
    () => service.create({ title: 'x'.repeat(201), body: '' }),
    () => service.create({ title: 'Draft', body: 'x'.repeat(100_001) }),
    () => service.update({ id: 'a', title: 'Draft', body: 1 }),
    () => service.delete('x'.repeat(129))
  ]) {
    await assert.rejects(run, ValiError);
  }
  assert.equal(f.calls(), 0);
  assert.deepEqual(await service.create({
    title: ' Draft ', body: 'Hello', id: 'injected', principal: 'admin', capabilities: ['content:write']
  }), { id: 'draft-1', title: 'Draft', body: 'Hello' });
});
