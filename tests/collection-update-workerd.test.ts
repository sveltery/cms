import test from 'node:test';
import assert from 'node:assert/strict';
import { Miniflare } from 'miniflare';
import { build } from 'vite';
import {viteWorkerModules,fixtureModulesRoot} from './helpers/vite-worker-modules.ts';
import type { Collection } from '../src/lib/server/database/contract.ts';

test('workerd: collection metadata service runs on the actual D1 binding without nodejs_compat', { timeout: 30000 }, async () => {
  const built = await build({ configFile: false, logLevel: 'error', build: { target: 'es2022', minify: false, write: false,
    lib: { entry: new URL('./helpers/collection-update-worker.ts', import.meta.url).pathname, formats: ['es'], fileName: 'collection-update-worker' } } });
  assert.ok(!('on' in built));
  const chunks = (Array.isArray(built) ? built : [built]).flatMap(output => output.output).filter(output => output.type === 'chunk');
  const runtime = new Miniflare({ modulesRoot:fixtureModulesRoot, modules:viteWorkerModules(chunks), compatibilityDate: '2026-05-07',
    host: '127.0.0.1', port: 0, cf: false, d1Databases: { DB: 'cms-update-workerd' } });
  try {
    const response = await runtime.dispatchFetch('https://cms.example/'); assert.equal(response.status, 200);
    const value = await response.json() as { before: Collection; updated: Collection; stored: Collection & { fields: unknown[] }; conflict: string };
    assert.equal(value.updated.label, 'Posts'); assert.equal(value.updated.labelSingular, 'Post');
    assert.equal(value.updated.description, 'Worker'); assert.deepEqual(value.updated.supports, []);
    assert.equal(value.updated.version, value.before.version);
    assert.ok(value.updated.updatedAt > value.before.updatedAt);
    assert.deepEqual(value.stored, { ...value.updated, fields: [] }); assert.equal(value.conflict, 'CONFLICT');
    const binding = await runtime.getD1Database('DB');
    assert.deepEqual((await binding.prepare('SELECT label, supports FROM _cms_collections').all()).results, [{ label: 'Posts', supports: '[]' }]);
    assert.deepEqual((await binding.prepare('SELECT * FROM _cms_guards').all()).results, []);
  } finally { await runtime.dispose(); }
});
