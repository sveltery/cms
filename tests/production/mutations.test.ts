import test from 'node:test';
import assert from 'node:assert/strict';
import { parse } from 'devalue';
import type { Handle } from '@sveltejs/kit';
import type { ContentRecord, ContentRepository, Principal } from '../../src/lib/server/content/service.ts';

function fixture(principal: Principal) {
  const records = new Map<string, ContentRecord>([['draft-1', { id: 'draft-1', title: 'Draft', body: 'Hello' }]]);
  const calls: string[] = [];
  const repository: ContentRepository = {
    async list() { calls.push('list'); return [...records.values()]; },
    async get(id) { calls.push('get'); return records.get(id) ?? null; },
    async create(value) { calls.push('create'); const record = { id: 'draft-2', ...value }; records.set(record.id, record); return record; },
    async update(id, value) { calls.push('update'); if (!records.has(id)) return null; const record = { id, ...value }; records.set(id, record); return record; },
    async delete(id) { calls.push('delete'); return records.delete(id); }
  };
  return { principal, repository, records, calls };
}

test('built remote mutation results survive separate query refresh errors', async (t) => {
  const built = (file: string) => import(new URL(`../../.svelte-kit/output/server/${file}`, import.meta.url).href);
  const { manifest } = await built('manifest.js');
  const { Server } = await built('index.js');
  const { options } = await built('internal.js');
  const server = new Server(manifest);
  await server.init({ env: {} });
  const hashes = Object.keys(manifest._.remotes);
  assert.equal(hashes.length, 1);
  const hash = hashes[0];
  const originalHandle = options.hooks.handle;
  let context = fixture({ id: 'editor', capabilities: ['content:read', 'content:write'] });
  // This isolated test process injects trusted locals into the already-built
  // server. No fixture hook, header-based identity, or bypass enters app source.
  const handle: Handle = ({ event, resolve }) => {
    event.locals.cms = context;
    return resolve(event);
  };
  options.hooks.handle = handle;
  async function mutate(name: string, input: Record<string, string>) {
    const response = await server.respond(new Request(`http://cms.test/_app/remote/${hash}/${name}`, {
      method: 'POST', headers: { origin: 'http://cms.test' }, body: new URLSearchParams(input)
    }), { getClientAddress: () => '127.0.0.1' });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    const envelope = await response.json();
    assert.equal(envelope.type, 'result', 'a refresh error must not become a mutation error');
    return parse(envelope.data);
  }
  try {
    await t.test('editor deletion succeeds while its refreshed detail reports not-found', async () => {
      const data = await mutate('deleteContent', { id: 'draft-1' });
      assert.equal(data._.submission, true);
      assert.equal(data._.issues, undefined);
      assert.deepEqual(context.calls, ['delete', 'list', 'get']);
      assert.equal(context.records.has('draft-1'), false);
      assert.deepEqual(Object.values(data.q).map((value: any) => value.v ?? value.e), [[], [404, { message: 'not-found' }]]);
    });
    await t.test('write-only create/update/delete preserve success without leaking refreshed reads', async () => {
      for (const [name, operation, input, expected] of [
        ['createContent', 'create', { title: 'New draft', body: 'Text' }, { id: 'draft-2' }],
        ['updateContent', 'update', { id: 'draft-1', title: 'Edited', body: 'Updated' }, { id: 'draft-1' }],
        ['deleteContent', 'delete', { id: 'draft-1' }, undefined]
      ] as const) {
        context = fixture({ id: 'writer', capabilities: ['content:write'] });
        const data = await mutate(name, input);
        assert.equal(data._.submission, true);
        assert.deepEqual(data._.result, expected);
        assert.equal(data._.issues, undefined);
        assert.deepEqual(context.calls, [operation], 'read authorization must stop refreshed storage reads');
        assert.equal(Object.keys(data.q).length, operation === 'create' ? 1 : 2);
        for (const value of Object.values(data.q) as Array<{ e: unknown; v?: unknown }>) {
          assert.deepEqual(value.e, [403, { message: 'forbidden' }]);
          assert.equal(Object.hasOwn(value, 'v'), false);
        }
        if (operation === 'create') assert.deepEqual(context.records.get('draft-2'), { id: 'draft-2', title: 'New draft', body: 'Text' });
        if (operation === 'update') assert.deepEqual(context.records.get('draft-1'), { id: 'draft-1', title: 'Edited', body: 'Updated' });
        if (operation === 'delete') assert.equal(context.records.has('draft-1'), false);
      }
    });
  } finally {
    options.hooks.handle = originalHandle;
  }
});
