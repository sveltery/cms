import test from 'node:test';
import assert from 'node:assert/strict';
import { preview } from 'vite';
import { remoteBoundaries } from '../helpers/remote.ts';

test('production build registers content remotes and enforces HTTP boundaries', async (t) => {
  const { manifest } = await import(new URL('../../.svelte-kit/output/server/manifest.js', import.meta.url).href);
  const ids = new Map<string, string>();
  for (const [hash, load] of Object.entries(manifest._.remotes)) {
    const { default: exports } = await (load as () => Promise<{ default: Record<string, unknown> }>)();
    for (const name of Object.keys(exports)) ids.set(name, `${hash}/${name}`);
  }
  assert.deepEqual([...ids.keys()].sort(), ['createContent', 'deleteContent', 'getContent', 'listContent', 'updateContent']);
  const server = await preview({ preview: { host: '127.0.0.1', port: 0 }, clearScreen: false });
  try {
    assert.ok(server.resolvedUrls);
    await remoteBoundaries(t, server.resolvedUrls.local[0], ids, true);
  } finally {
    await new Promise<void>((resolve, reject) => server.httpServer.close((error) => error ? reject(error) : resolve()));
  }
});
