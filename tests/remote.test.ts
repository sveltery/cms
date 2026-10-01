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
    const source = await (await fetch(new URL('src/lib/content.remote.ts', base))).text();
    const ids = new Map([...source.matchAll(/export const (\w+) = __remote\.(?:query|form)\('([^']+)'\)/g)]
      .map((match) => [match[1], match[2]]));
    assert.equal(ids.size, 5);
    await remoteBoundaries(t, base, ids, false);
  } finally {
    await server.close();
  }
});
