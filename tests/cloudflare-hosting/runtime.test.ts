// Supplemental built Worker/D1 verification; no upstream or passkey assertion credit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { Miniflare } from 'miniflare';
import { parse, stringify } from 'devalue';
import { encodeBase64urlNoPadding } from '@oslojs/encoding';
import { openD1 } from '../../src/lib/server/database/d1.ts';
import { SchemaRegistry } from '../../src/lib/server/database/registry.ts';
import { hashSessionToken } from '../../src/lib/server/auth/session.ts';
import { Role } from '../../src/lib/server/auth/roles.ts';

const builtWorker = resolve('build/cloudflare/worker/worker.js');
const assets = resolve('build/cloudflare/assets');
const publicOrigin = 'https://cms.example';
async function remoteIds() {
  const { manifest } = await import(new URL('../../.svelte-kit/output/server/manifest.js', import.meta.url).href);
  const ids = new Map<string, string>();
  for (const [hash, load] of Object.entries(manifest._.remotes)) {
    const { default: exports } = await (load as () => Promise<{ default: Record<string, unknown> }>)();
    for (const name of Object.keys(exports)) ids.set(name, `${hash}/${name}`);
  }
  return ids;
}
async function request(worker: Miniflare, ids: Map<string, string>, name: string, cookie?: string, argument?: unknown, input?: Record<string, string>) {
  assert.ok(ids.has(name), `Built remote ${name} is registered`);
  const suffix = argument === undefined ? '' : `?payload=${Buffer.from(stringify(argument)).toString('base64url')}`;
  const response = await worker.dispatchFetch(`${publicOrigin}/_app/remote/${ids.get(name)}${suffix}`, {
    ...(input ? { method: 'POST', body: new URLSearchParams(input) } : {}),
    headers: { origin: publicOrigin, 'cf-connecting-ip': '127.0.0.1', ...(cookie ? { cookie } : {}) }
  });
  assert.equal(response.status, 200);
  return { response, body: await response.json() as any };
}
function fixture(scriptPath: string, persistPath: string, configured = true) {
  return new Miniflare({ modulesRoot: dirname(scriptPath), modules: [{ type: 'ESModule', path: scriptPath }, ...(scriptPath === builtWorker ? [] : [{ type: 'ESModule' as const, path: join(dirname(scriptPath), 'worker.mjs') }])], compatibilityDate: '2026-05-07', compatibilityFlags: ['nodejs_compat'],
    assets: { directory: assets, binding: 'ASSETS', routerConfig: { has_user_worker: true, invoke_user_worker_ahead_of_assets: true } }, cf: false, d1Persist: persistPath,
    ...(configured ? { d1Databases: { CMS_DB: 'cms-built-worker-d1' }, bindings: {
      CMS_PUBLIC_ORIGIN: publicOrigin, SVELTERY_D1_SESSION: 'auto', SVELTERY_D1_COALESCE: 'true'
    } } : {})
  });
}

test('built Cloudflare Worker stays unavailable without operator storage configuration', { timeout: 30_000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'cms-worker-unconfigured-'));
  const worker = fixture(builtWorker, directory, false);
  try {
    const { body } = await request(worker, await remoteIds(), 'getEditorManifest');
    assert.equal(body.status, 401);
    assert.equal(body.error.code, 'UNAUTHENTICATED');
  } finally { await worker.dispose(); await rm(directory, { recursive: true, force: true }); }
});

test('built Cloudflare Worker migrates persistent D1 and enforces current sessions across restart', { timeout: 60_000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'cms-worker-persistent-'));
  // Observer forwards the exact official artifact and execution context.
  // It only counts waitUntil calls; application hooks/remotes are unchanged.
  await cp(builtWorker, join(directory, 'worker.mjs'));
  await writeFile(join(directory, 'observer.mjs'), `import app from './worker.mjs';
    export default { async fetch(req, env, ctx) {
      let tasks = 0;
      const response = await app.fetch(req, env, { waitUntil(task) { tasks++; ctx.waitUntil(task); }, passThroughOnException() { ctx.passThroughOnException(); } });
      response.headers.set('x-fixture-waituntil-count', String(tasks));
      return response;
    } };
  `);
  const scriptPath = join(directory, 'observer.mjs');
  const persistPath = join(directory, 'd1');
  let worker = fixture(scriptPath, persistPath);
  const ids = await remoteIds();
  const token = encodeBase64urlNoPadding(crypto.getRandomValues(new Uint8Array(32)));
  const cookie = `cms-session=${token}`;
  let operator: ReturnType<typeof openD1> | undefined;
  try {
    const anonymous = await Promise.all(Array.from({ length: 4 }, () => request(worker, ids, 'getEditorManifest')));
    assert.ok(anonymous.every(result => result.body.status === 401));
    assert.ok(anonymous.every(result => !result.response.headers.get('set-cookie')?.includes('__em_d1_bookmark')));
    operator = openD1(await worker.getD1Database('CMS_DB'));
    const versions = await operator.db.selectFrom('_cms_migrations').select('version').execute();
    assert.ok(versions.some(row => row.version === 4));
    assert.equal(new Set(versions.map(row => row.version)).size, versions.length);
    const registry = new SchemaRegistry(operator);
    await registry.createCollection({ slug: 'notes', label: 'Notes' });
    await registry.createField('notes', { slug: 'headline', label: 'Headline', type: 'string', required: true });
    await operator.db.insertInto('_cms_auth_users').values({ id: 'worker-owner', role: Role.AUTHOR, disabled: 0 }).execute();
    await operator.db.insertInto('_cms_auth_sessions').values({ hash: (await hashSessionToken(token))!, user_id: 'worker-owner', expires_at: Date.now() + 60_000 }).execute();
    const editor = await request(worker, ids, 'getEditorManifest', cookie);
    assert.equal(editor.body.type, 'result');
    assert.ok(Number(editor.response.headers.get('x-fixture-waituntil-count')) >= 1);
    assert.match(editor.response.headers.get('set-cookie') ?? '', /__em_d1_bookmark=.+HttpOnly/i);
    const created = await request(worker, ids, 'createContent', cookie, undefined, { collection: 'notes', 'data.headline': 'Persistent Worker draft' });
    assert.equal(created.body.type, 'result');
    const receipt = parse(created.body.data)._.result;
    assert.ok(receipt.id);
    await operator.close(); operator = undefined;
    await worker.dispose();
    worker = fixture(scriptPath, persistPath);
    const read = await request(worker, ids, 'getContent', cookie, { collection: 'notes', id: receipt.id });
    assert.equal(read.body.type, 'result');
    assert.equal(parse(read.body.data)._.data.headline, 'Persistent Worker draft');
    assert.equal(parse(read.body.data)._.authorId, 'worker-owner');
    // An ordinary route error is returned by Kit as a Response; it must keep
    // its status envelope and the completed read bookmark on the success handoff.
    const missing = await request(worker, ids, 'getContent', cookie, { collection: 'notes', id: 'missing-worker-draft' });
    assert.equal(missing.body.status, 404);
    assert.match(missing.response.headers.get('set-cookie') ?? '', /__em_d1_bookmark=.+HttpOnly/i);
    operator = openD1(await worker.getD1Database('CMS_DB'));
    await operator.db.updateTable('_cms_auth_users').set({ role: Role.SUBSCRIBER }).where('id', '=', 'worker-owner').execute();
    const demoted = await request(worker, ids, 'getEditorManifest', cookie);
    assert.equal(demoted.body.status, 403);
    await operator.db.updateTable('_cms_auth_users').set({ role: Role.AUTHOR, disabled: 1 }).where('id', '=', 'worker-owner').execute();
    const disabled = await request(worker, ids, 'getEditorManifest', cookie);
    assert.equal(disabled.body.status, 401);
    await operator.db.updateTable('_cms_auth_users').set({ disabled: 0 }).where('id', '=', 'worker-owner').execute();
    await operator.db.deleteFrom('_cms_auth_sessions').where('hash', '=', (await hashSessionToken(token))!).execute();
    const revoked = await request(worker, ids, 'getEditorManifest', cookie);
    assert.equal(revoked.body.status, 401);
  } finally { await operator?.close(); await worker.dispose(); await rm(directory, { recursive: true, force: true }); }
});

test('Cloudflare artifact excludes unsupported Node SQLite and trusted-session fixtures', async () => {
  const text = await readFile(builtWorker, 'utf8');
  assert.ok(!text.includes('node:sqlite'));
  assert.ok(!text.includes('worker-owner'));
  assert.ok(!text.includes('Persistent Worker draft'));
});
