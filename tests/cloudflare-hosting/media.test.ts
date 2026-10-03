// Original official Worker/D1/R2 product acceptance; zero copied callback credit.
// One ordinary credential registration/login, actual objects and persistent restart.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { Miniflare } from 'miniflare';
import { webauthnCredential } from '../helpers/webauthn-credential.ts';

test('official Worker streams, confirms and deduplicates R2 media with persisted D1 folders and metadata', { timeout: 60_000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'cms-worker-media-'));
  const scriptPath = resolve('build/cloudflare/worker/worker.js');
  const origin = 'https://cms.example', credential = webauthnCredential(origin);
  const cookies = new Map<string, string>();
  const png = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jhRkAAAAASUVORK5CYII=', 'base64'));
  const contentHash = `sha1:${createHash('sha1').update(png).digest('hex')}`;
  function start() {
    return new Miniflare({ modulesRoot: dirname(scriptPath), modules: [{ type: 'ESModule', path: scriptPath }],
      compatibilityDate: '2026-05-07', compatibilityFlags: ['nodejs_compat'], cf: false,
      assets: { directory: resolve('build/cloudflare/assets'), binding: 'ASSETS',
        routerConfig: { has_user_worker: true, invoke_user_worker_ahead_of_assets: true } },
      d1Persist: join(directory, 'd1'), d1Databases: { CMS_DB: 'cms-media-worker-d1' },
      r2Persist: join(directory, 'r2'), r2Buckets: { CMS_MEDIA: 'cms-media-worker-r2' },
      bindings: { CMS_PUBLIC_ORIGIN: origin, SVELTERY_D1_SESSION: 'auto', SVELTERY_D1_COALESCE: 'true' } });
  }
  let worker = start();
  async function request(path: string, method = 'GET', body?: unknown, supplied?: HeadersInit) {
    const headers = new Headers(supplied);
    headers.set('origin', origin); headers.set('cf-connecting-ip', '127.0.0.1');
    if (cookies.size) headers.set('cookie', [...cookies].map(([key, value]) => `${key}=${value}`).join('; '));
    const binary = body instanceof Uint8Array;
    if (body !== undefined && !binary) headers.set('content-type', 'application/json');
    const response = await worker.dispatchFetch(`${origin}${path}`, { method, headers,
      ...(body === undefined ? {} : { body: binary ? body : JSON.stringify(body) }) });
    for (const cookie of response.headers.getSetCookie()) {
      const [pair] = cookie.split(';'), index = pair.indexOf('=');
      if (/max-age=0(?:;|$)/i.test(cookie)) cookies.delete(pair.slice(0, index));
      else cookies.set(pair.slice(0, index), pair.slice(index + 1));
    }
    return response;
  }
  async function json(path: string, method: string, body: unknown, status = 200) {
    const response = await request(path, method, body);
    assert.equal(response.status, status, `${method} ${path}`);
    const result = await response.json() as { success: boolean; data: any };
    assert.equal(result.success, true); return result.data;
  }
  try {
    const begin = await json('/api/setup/admin', 'POST', { email: 'worker-media@example.com', name: 'Media administrator' });
    await json('/api/setup/admin/verify', 'POST', { credential: credential.registration(begin.options.challenge) });
    const options = await json('/api/auth/passkey/options', 'POST', {});
    await json('/api/auth/passkey/verify', 'POST', { credential: credential.assertion(options.options.challenge) });
    const actor = await json('/api/auth/me', 'GET', undefined);
    assert.equal(actor.role, 50);
    const folder = (await json('/api/media/folders', 'POST', { name: 'Worker images' }, 201)).item;
    const uploadBody = { filename: 'worker.png', contentType: 'image/png', size: png.byteLength, contentHash, folderId: folder.id };
    const upload = await json('/api/media/upload-url', 'POST', uploadBody);
    assert.equal(upload.method, 'PUT');
    assert.equal(upload.uploadUrl, `/_emdash/api/media/${upload.mediaId}/upload`);
    const streamed = await request(upload.uploadUrl, upload.method, png, upload.headers);
    assert.equal(streamed.status, 200);
    const item = (await json(`/api/media/${upload.mediaId}/confirm`, 'POST', { contentHash })).item;
    assert.equal(item.status, 'ready'); assert.equal(item.width, 1); assert.equal(item.height, 1);
    assert.equal(item.folderId, folder.id); assert.equal(item.authorId, actor.id);
    assert.ok(item.blurhash); assert.equal(item.dominantColor, 'rgb(255,255,255)');
    assert.notEqual(item.storageKey, upload.storageKey);
    const bucket = await worker.getR2Bucket('CMS_MEDIA');
    const object = await bucket.get(item.storageKey);
    assert.ok(object); assert.deepEqual(new Uint8Array(await object.arrayBuffer()), png);
    assert.equal(object.httpMetadata?.contentType, 'image/png');
    const served = await request(item.url);
    assert.equal(served.status, 200); assert.equal(served.headers.get('content-type'), 'image/png');
    assert.deepEqual(new Uint8Array(await served.arrayBuffer()), png);
    const duplicate = await json('/api/media/upload-url', 'POST', uploadBody);
    assert.equal(duplicate.existing, true); assert.equal(duplicate.mediaId, item.id);
    await json(`/api/media/${item.id}`, 'PUT', { alt: 'Worker image', caption: 'Stored in R2', focalX: 0.25, focalY: 0.75 });
    await worker.dispose(); worker = start();
    const restored = (await json(`/api/media/${item.id}`, 'GET', undefined)).item;
    assert.equal(restored.alt, 'Worker image'); assert.equal(restored.focalX, 0.25); assert.equal(restored.focalY, 0.75);
    assert.equal((await json('/api/media?folderId=' + folder.id + '&q=worker&mimeType=image/png&page=1&limit=1', 'GET', undefined)).totalCount, 1);
    const restartedAsset = await request(item.url);
    assert.equal(restartedAsset.status, 200); assert.deepEqual(new Uint8Array(await restartedAsset.arrayBuffer()), png);
    await json(`/api/media/folders/${folder.id}`, 'DELETE', undefined);
    assert.equal((await json(`/api/media/${item.id}`, 'GET', undefined)).item.folderId, null);
    await json(`/api/media/${item.id}`, 'DELETE', undefined);
    assert.equal(await (await worker.getR2Bucket('CMS_MEDIA')).get(item.storageKey), null);
    assert.equal((await request(item.url)).status, 404);
    assert.equal((await json('/api/media?page=1&limit=1', 'GET', undefined)).totalCount, 0);
    const database = await worker.getD1Database('CMS_DB');
    assert.equal((await database.prepare('SELECT COUNT(*) AS count FROM media').first<{ count: number }>())?.count, 0);
  } finally { await worker.dispose(); await rm(directory, { recursive: true, force: true }); }
});
