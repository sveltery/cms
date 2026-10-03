import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stringify, parse } from 'devalue';
import { schemaAdminStorage } from './schema-admin-storage.ts';

export async function passkeyRuntime(target: 'Node' | 'D1' = 'Node', options: {media?:true|'local'|'r2'} = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'cms-passkey-runtime-'));
  const socket = createServer(); socket.listen(0, '127.0.0.1'); await once(socket, 'listening');
  const address = socket.address(); assert.ok(address && typeof address === 'object');
  const port = address.port; await new Promise<void>(resolve => socket.close(() => resolve()));
  const origin = `http://localhost:${port}`;
  let child: ReturnType<typeof spawn>;
  let exited: Promise<unknown[]>;
  let output = '';
  let ids: Record<string, string> = {};
  let storage: Awaited<ReturnType<typeof schemaAdminStorage>> | undefined;
  async function start() {
    output = '';
    child = spawn(process.execPath, ['tests/helpers/passkey-runtime-server.mjs'], {
      cwd: new URL('../../', import.meta.url), stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      env: { PATH: process.env.PATH, CMS_AUTH_TARGET: target, CMS_AUTH_DIRECTORY: directory,
        SVELTERY_PUBLIC_ORIGIN: origin,
        ...(options.media===true||options.media==='r2' ? {CMS_AUTH_MEDIA:'true'} : {}),
        ...(options.media==='local' ? {SVELTERY_MEDIA_DIRECTORY:join(directory,'media-local')} : {}),
        ...(target === 'Node' ? { SVELTERY_DATABASE_PATH: join(directory, 'schema.sqlite') } : {}) }
    });
    exited = once(child, 'exit');
    child.stdout!.on('data', data => { output += data; });
    child.stderr!.on('data', data => { output += data; });
    const deadline = Date.now() + 20_000;
    while (!output.includes('CMS_PASSKEY_READY ')) {
      assert.equal(child.exitCode, null, output); assert.ok(Date.now() < deadline, output);
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    ids = JSON.parse(output.split('CMS_PASSKEY_READY ')[1].split('\n')[0]).ids;
  }
  async function stop() {
    if (!child || child.exitCode !== null) return;
    child.send({ type: 'close' }); const timer = setTimeout(() => child.kill('SIGKILL'), 5_000);
    try { const [code] = await exited; assert.equal(code, 0, output); } finally { clearTimeout(timer); }
  }
  await start();
  async function request(path: string, init: RequestInit = {}) {
    return fetch(new URL(path, origin), { ...init, signal: AbortSignal.timeout(10_000) });
  }
  function browser() {
    const cookies = new Map<string, string>();
    function headers(input: HeadersInit = {}) {
      const headers = new Headers(input);
      if (cookies.size) headers.set('cookie', [...cookies].map(([key, value]) => `${key}=${value}`).join('; '));
      return headers;
    }
    return { cookies,
      async get(path: string, input: HeadersInit = {}) { return request(path, { headers: headers(input) }); },
      async submitNative(path: string, body = new URLSearchParams()) {
        const response = await request(path, { method: 'POST', redirect: 'manual',
          headers: headers({ origin, accept: 'text/html', 'content-type': 'application/x-www-form-urlencoded' }), body });
        for (const cookie of response.headers.getSetCookie()) {
          const [pair] = cookie.split(';'), index = pair.indexOf('=');
          if (/max-age=0(?:;|$)/i.test(cookie)) cookies.delete(pair.slice(0, index));
          else cookies.set(pair.slice(0, index), pair.slice(index + 1));
        }
        return response;
      },
      async post(path: string, body: unknown, originHeader = origin) {
        const response = await request(path, { method: 'POST', headers: headers({ origin: originHeader, 'content-type': 'application/json' }), body: JSON.stringify(body) });
        for (const cookie of response.headers.getSetCookie()) {
          const [pair] = cookie.split(';'), index = pair.indexOf('=');
          if (/max-age=0(?:;|$)/i.test(cookie)) cookies.delete(pair.slice(0, index));
          else cookies.set(pair.slice(0, index), pair.slice(index + 1));
        }
        return response;
      },
      async query(name: string, argument?: unknown) {
        assert.ok(ids[name], `registered remote ${name}`);
        const payload = argument === undefined ? '' : `?payload=${Buffer.from(stringify(argument)).toString('base64url')}`;
        const response = await request(`/_app/remote/${ids[name]}${payload}`, { headers: headers() });
        const envelope = await response.json();
        return envelope.type === 'result' ? { envelope, data: parse(envelope.data)._ } : { envelope, data: undefined };
      }
    };
  }
  return { origin, directory, request, browser, get ids() { return ids; }, diagnostics() {return output;},
    async database() { storage ??= await schemaAdminStorage(target, directory); return storage.database; },
    async restart() { await storage?.close(); storage = undefined; await stop(); await start(); },
    async close() { await storage?.close(); await stop(); await rm(directory, { recursive: true, force: true }); }
  };
}
