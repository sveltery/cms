import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { remoteBoundaries } from './helpers/remote.ts';

test('development HTTP remote boundaries fail closed', async (t) => {
  const server = await createServer({ server: { host: '127.0.0.1', port: 0 }, clearScreen: false });
  try {
    await server.listen();
    const base = server.resolvedUrls!.local[0];
    // Read Kit's generated client IDs; production tests use only the built registry.
    const sources = await Promise.all(['content', 'schema'].map(async module =>
      (await fetch(new URL(`src/lib/${module}.remote.ts`, base))).text()));
    const ids = new Map(sources.flatMap(source => [...source.matchAll(/export const (\w+) = __remote\.(?:query|form)\('([^']+)'\)/g)]
      .map((match) => [match[1], match[2]] as const)));
    assert.deepEqual([...ids.keys()].sort(), [
      'addSchemaField', 'countTrashedContent', 'createContent', 'createSchemaCollection',
      'deleteContent', 'deleteSchemaCollection', 'deleteSchemaField', 'getCollection', 'getContent',
      'getEditorManifest', 'getSchemaCollection', 'getTrashedContent', 'listCollections', 'listContent',
      'listSchemaCollections', 'listTrashedContent', 'reorderSchemaCollections', 'reorderSchemaFields',
      'restoreContent', 'updateContent', 'updateSchemaCollection', 'updateSchemaFieldLabel',
      'updateSchemaFieldMetadata', 'updateSchemaFieldOptions'
    ]);
    await remoteBoundaries(t, base, ids, false);
  } finally {
    await server.close();
  }
});
