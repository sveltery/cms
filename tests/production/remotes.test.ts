import test from 'node:test';
import assert from 'node:assert/strict';
import { preview } from 'vite';
import { readdir, readFile } from 'node:fs/promises';
import { remoteBoundaries } from '../helpers/remote.ts';

test('production build registers CMS remotes and enforces HTTP boundaries', async (t) => {
  const { manifest } = await import(new URL('../../.svelte-kit/output/server/manifest.js', import.meta.url).href);
  const ids = new Map<string, string>();
  for (const [hash, load] of Object.entries(manifest._.remotes)) {
    const { default: exports } = await (load as () => Promise<{ default: Record<string, unknown> }>)();
    for (const name of Object.keys(exports)) ids.set(name, `${hash}/${name}`);
  }
  assert.deepEqual([...ids.keys()].sort(), ['addSchemaField', 'createContent', 'createSchemaCollection', 'deleteContent', 'getCollection', 'getContent', 'getEditorManifest', 'getSchemaCollection', 'getTrashedContent', 'listCollections', 'listContent', 'listSchemaCollections', 'listTrashedContent', 'restoreContent', 'updateContent', 'updateSchemaCollection', 'updateSchemaFieldLabel']);
  const server = await preview({ preview: { host: '127.0.0.1', port: 0 }, clearScreen: false });
  try {
    assert.ok(server.resolvedUrls);
    await remoteBoundaries(t, server.resolvedUrls.local[0], ids, true);
  } finally {
    await new Promise<void>((resolve, reject) => server.httpServer.close((error) => error ? reject(error) : resolve()));
  }
});

test('production artifacts contain neither the trusted-session fixture nor a Node SQLite opener', async () => {
  async function inspect(path: string) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const child = `${path}/${entry.name}`;
      if (entry.isDirectory()) await inspect(child);
      else if (/\.(?:js|json|html)$/.test(entry.name)) {
        const source = await readFile(child, 'utf8');
        assert.doesNotMatch(source, /cms-test-session|cms-remotes-|user_writer|node:sqlite|openSqlite/);
      }
    }
  }
  await inspect(new URL('../../.svelte-kit/output', import.meta.url).pathname);
});
