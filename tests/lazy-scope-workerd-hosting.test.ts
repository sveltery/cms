// Supplemental Native allocation control; Source/old Worker tests remain exact.
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'vite';
import { Miniflare } from 'miniflare';
import { fixtureModulesRoot, viteWorkerModules } from './helpers/vite-worker-modules.ts';

test('no-node compatibility Worker retains actual unsupported scope creation failure', { timeout: 30_000 }, async () => {
  const built = await build({ configFile: false, logLevel: 'error',
    build: { target: 'es2022', minify: false, write: false,
      lib: { entry: new URL('./helpers/lazy-scope-worker.ts', import.meta.url).pathname, formats: ['es'], fileName: 'lazy-scope-worker' } } });
  assert.ok(!('on' in built));
  const chunks = (Array.isArray(built) ? built : [built]).flatMap(output => output.output).filter(output => output.type === 'chunk');
  const runtime = new Miniflare({ modulesRoot: fixtureModulesRoot, modules: viteWorkerModules(chunks),
    compatibilityDate: '2026-05-07', host: '127.0.0.1', port: 0, cf: false });
  try {
    const response = await runtime.dispatchFetch('https://scope.example/');
    assert.equal(response.status, 200);
    const value = await response.json() as { callbackReached: boolean; beforeAbsent: boolean; afterAbsent: boolean;
      constructed: boolean; error: { name: string; message: string } };
    assert.equal(value.beforeAbsent, true);
    assert.equal(value.afterAbsent, true);
    assert.equal(value.callbackReached, false);
    assert.equal(value.constructed, false);
    assert.equal(value.error.name, 'TypeError');
    assert.match(value.error.message, /AsyncLocalStorage.*not a constructor/);
  } finally { await runtime.dispose(); }
});
