// Ephemeral real built Kit runtime. Supplies only operator storage/origin configuration;
// no hook replacement, user/session seeding or credential-verification bypass.
import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Miniflare } from 'miniflare';
import { listenRuntime } from './runtime-listener.mjs';

const output = resolve(process.env.CMS_AUTH_OUTPUT ?? '.svelte-kit/output');
const configuredOrigin = process.env.SVELTERY_PUBLIC_ORIGIN;
if (!configuredOrigin) throw new Error('Fixture requires a trusted public origin');
const http = createServer();
const publicOrigin = await listenRuntime(http, configuredOrigin);
process.env.SVELTERY_PUBLIC_ORIGIN = publicOrigin;
const built = file => import(pathToFileURL(resolve(output, 'server', file)).href);
let d1;
let platform;
if (process.env.CMS_AUTH_TARGET === 'D1') {
  d1 = new Miniflare({ modules: true,
    script: 'export default { fetch() { return new Response("passkey raw D1 runtime fixture"); } }',
    compatibilityDate: '2026-05-07', host: '127.0.0.1', port: 0, cf: false,
    d1Databases: { DB: 'cms-schema-admin' }, d1Persist: process.env.CMS_AUTH_DIRECTORY });
  platform = { env: { CMS_DB: await d1.getD1Database('DB'), CMS_PUBLIC_ORIGIN: publicOrigin } };
}
const { manifest } = await built('manifest.js');
const { Server } = await built('index.js');
const server = new Server(manifest);
await server.init({ env: { ...process.env } });
const ids = {};
for (const [hash, load] of Object.entries(manifest._.remotes)) {
  for (const name of Object.keys((await load()).default)) ids[name] = `${hash}/${name}`;
}
http.on('request', async (incoming, outgoing) => {
  try {
    const requestUrl = new URL(incoming.url ?? '/', publicOrigin);
    if (requestUrl.pathname.startsWith('/_app/') && !requestUrl.pathname.startsWith('/_app/remote/')) {
      const root = resolve(output, 'client');
      const path = resolve(root, `.${decodeURIComponent(requestUrl.pathname)}`);
      if (!path.startsWith(root + sep)) { outgoing.writeHead(400); outgoing.end(); return; }
      const body = await readFile(path);
      outgoing.writeHead(200, { 'content-type': path.endsWith('.js') ? 'text/javascript' : path.endsWith('.css') ? 'text/css' : 'application/octet-stream' });
      outgoing.end(body); return;
    }
    const headers = new Headers();
    for (const [key, value] of Object.entries(incoming.headers)) if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
    const request = new Request(requestUrl, { method: incoming.method, headers,
      ...(incoming.method === 'GET' || incoming.method === 'HEAD' ? {} : { body: Readable.toWeb(incoming), duplex: 'half' }) });
    const response = await server.respond(request, { getClientAddress: () => '127.0.0.1', platform });
    const responseHeaders = Object.fromEntries(response.headers);
    const cookies = response.headers.getSetCookie();
    if (cookies.length) responseHeaders['set-cookie'] = cookies;
    outgoing.writeHead(response.status, responseHeaders);
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch (cause) { outgoing.writeHead(500); outgoing.end(String(cause)); }
});
console.log('CMS_PASSKEY_READY ' + JSON.stringify({ ids, origin: publicOrigin }));
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  await new Promise(resolve => http.close(resolve));
  await d1?.dispose();
  process.exit(0);
}
process.on('SIGTERM', () => void close());
process.on('SIGINT', () => void close());
process.on('message', message => { if (message?.type === 'close') void close(); });
