import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'vite';
import { Miniflare } from 'miniflare';

test('local workerd: portable auth core runs without nodejs_compat or a persistence adapter', { timeout: 30000 }, async () => {
  const built = await build({
    configFile: false, logLevel: 'error',
    build: {
      target: 'es2022', minify: false, write: false,
      lib: { entry: new URL('./helpers/auth-worker.ts', import.meta.url).pathname, formats: ['es'], fileName: 'auth-worker' }
    }
  });
  assert.ok(!('on' in built));
  const outputs = Array.isArray(built) ? built : [built];
  const chunks = outputs.flatMap((output) => output.output).filter((output) => output.type === 'chunk');
  assert.equal(chunks.length, 1);
  const runtime = new Miniflare({ modules: true, script: chunks[0].code, compatibilityDate: '2026-05-07', host: '127.0.0.1', port: 0 });
  try {
    const response = await runtime.dispatchFetch('https://cms.example/');
    assert.equal(response.status, 200);
    const data = await response.json() as { passed: string[] };
    assert.deepEqual(data.passed, [
      'source: resolved session user and user-key lookup', 'source: missing session', 'source: stalled session', 'source: rejected session',
      'local: upstream-compatible SHA-256 hash', 'local: trusted minimal principal and request waitUntil',
      'source: author owns content', 'source: author cannot edit others', 'local: null ownership denial',
      'local: exact expiry', 'local: current role demotion', 'local: disabled user denial', 'local: revocation',
      'local: role-cookie injection denial', 'local: origin denial and cookie flags'
    ]);
  } finally { await runtime.dispose(); }
});
