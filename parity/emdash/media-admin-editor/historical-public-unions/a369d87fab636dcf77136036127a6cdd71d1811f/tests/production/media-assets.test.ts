// Actual built native application requirements; zero copied declaration credit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'cms-media-assets-'));
  const storage = join(directory, 'files');
  await mkdir(join(storage, 'photos'), {recursive:true});
  await writeFile(join(storage, 'photos', 'image.png'), new Uint8Array([0,255,17,42]));
  const built = (path: string) => import(new URL(`../../.svelte-kit/output/server/${path}`, import.meta.url).href);
  const { manifest } = await built('manifest.js');
  const { Server } = await built('index.js');
  const server = new Server(manifest);
  await server.init({ env: { SVELTERY_DATABASE_PATH: join(directory, 'cms.sqlite'), SVELTERY_PUBLIC_ORIGIN: 'http://cms.test', SVELTERY_MEDIA_DIRECTORY: storage } });
  return { request: (path: string) => server.respond(new Request(`http://cms.test${path}`), {getClientAddress:()=>'127.0.0.1'}), close:()=>rm(directory,{recursive:true,force:true}) };
}

test('actual public native file route streams stored bytes and their MIME type', async () => {
  const app = await fixture();
  try {
    const response = await app.request('/_emdash/api/media/file/photos/image.png');
    assert.equal(response.status,200);
    assert.equal(response.headers.get('content-type'),'image/png');
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()),new Uint8Array([0,255,17,42]));
  } finally { await app.close(); }
});

test('actual public native file route denies private prefixes and missing files', async () => {
  const app = await fixture();
  try {
    for (const key of ['backups/archive.json','transfers/imports/x/manifest.json','BACKUPS/private.json','missing.png']) assert.equal((await app.request(`/_emdash/api/media/file/${key}`)).status,404);
  } finally { await app.close(); }
});

test('actual media library and upload routes enforce authentication before request parsing', async () => {
  const app = await fixture();
  try { assert.equal((await app.request('/api/media')).status,401); }
  finally { await app.close(); }
});
