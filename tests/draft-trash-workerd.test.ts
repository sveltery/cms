// Supplemental draft-only runtime portability, not deployed Cloudflare evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Miniflare } from 'miniflare';
import { build } from 'vite';
import type { DraftEntry, TrashedDraftEntry } from '../src/lib/server/database/contract.ts';
test('workerd: draft restore uses actual D1 without nodejs_compat, with one concurrent CAS winner', { timeout: 30000 }, async () => {
  const built = await build({ configFile: false, logLevel: 'error', build: { target: 'es2022', minify: false, write: false,
    lib: { entry: new URL('./helpers/draft-trash-worker.ts', import.meta.url).pathname, formats: ['es'], fileName: 'draft-trash-worker' } } });
  assert.ok(!('on' in built));
  const chunks = (Array.isArray(built) ? built : [built]).flatMap(output => output.output).filter(output => output.type === 'chunk');
  assert.equal(chunks.length, 1); assert.doesNotMatch(chunks[0].code, /node:sqlite/);
  const runtime = new Miniflare({ modules: true, script: chunks[0].code, compatibilityDate: '2026-05-07',
    host: '127.0.0.1', port: 0, cf: false, d1Databases: { DB: 'cms-trash-worker' } });
  try {
    const response = await runtime.dispatchFetch('https://cms.example/'); assert.equal(response.status, 200);
    const result = await response.json() as { trash: TrashedDraftEntry; restored: DraftEntry; outcomes: string[]; items: unknown[] };
    assert.deepEqual(result.outcomes.sort(), ['CONFLICT', 'restored']); assert.equal(result.trash.locale, 'fr');
    assert.deepEqual(result.restored.data, result.trash.data); assert.equal(result.restored.version, result.trash.version + 1);
    assert.ok(result.restored.updatedAt > result.trash.updatedAt); assert.deepEqual(result.items, []);
    const binding = await runtime.getD1Database('DB');
    assert.deepEqual((await binding.prepare('SELECT * FROM _cms_guards').all()).results, []);
  } finally { await runtime.dispose(); }
});
