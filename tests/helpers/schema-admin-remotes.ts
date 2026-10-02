import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { parse, stringify } from 'devalue';
import type { Handle } from '@sveltejs/kit';
import type { CmsDatabase } from '../../src/lib/server/database/contract.ts';
import { encodeBase64urlNoPadding } from '@oslojs/encoding';
import { sql } from 'kysely';
import { migrateCms } from '../../src/lib/server/database/migrations.ts';
import { SchemaRegistry } from '../../src/lib/server/database/registry.ts';
import { createCmsHandle } from '../../src/lib/server/auth/composition.ts';
import { hashSessionToken } from '../../src/lib/server/auth/session.ts';
import { Role } from '../../src/lib/server/auth/roles.ts';
import { schemaAdminStorage } from './schema-admin-storage.ts';

/** Isolated persisted trusted test sessions and actual built Kit remotes; no app imports this. */
export async function schemaAdminRemotes(target: 'Node' | 'D1', mutationsEnabled = true,
  fixture: { output?: string; base?: string } = {}) {
  const output = fixture.output ?? new URL('../../.svelte-kit/output/', import.meta.url).pathname;
  const base = fixture.base ?? '';
  const directory = await mkdtemp(join(tmpdir(), 'cms-schema-admin-'));
  let storage = await schemaAdminStorage(target, directory);
  await migrateCms(storage.database);
  const tokens: Record<string, string> = {};
  for (const [name, role] of Object.entries({ admin: Role.ADMIN, editor: Role.EDITOR, author: Role.AUTHOR, subscriber: Role.SUBSCRIBER })) {
    tokens[name] = encodeBase64urlNoPadding(crypto.getRandomValues(new Uint8Array(32)));
    await storage.database.db.insertInto('_cms_auth_users').values({ id: `schema_${name}`, role, disabled: 0 }).execute();
    await storage.database.db.insertInto('_cms_auth_sessions').values({ hash: (await hashSessionToken(tokens[name]))!, user_id: `schema_${name}`, expires_at: Date.now() + 600_000 }).execute();
  }
  const built = (file: string) => import(pathToFileURL(join(output, 'server', file)).href);
  const { manifest } = await built('manifest.js');
  const { Server } = await built('index.js');
  const { options } = await built('internal.js');
  const ids = new Map<string, string>();
  for (const [hash, load] of Object.entries(manifest._.remotes)) {
    const { default: exports } = await (load as () => Promise<{ default: Record<string, unknown> }>)();
    for (const name of Object.keys(exports)) ids.set(name, `${hash}/${name}`);
  }
  let server = new Server(manifest); await server.init({ env: {} });
  const originalHandle = options.hooks.handle;
  const authenticatedHandle = createCmsHandle(() => ({ database: storage.database, mutationsEnabled }));
  let storageProbe: 'throw' | 'absent' | undefined;
  let storageReads = 0;
  const handle: Handle = input => authenticatedHandle({ ...input, resolve(event, options) {
    if (storageProbe && event.locals.cms) {
      const context = event.locals.cms;
      event.locals.cms = { principal: context.principal, mutationsEnabled: context.mutationsEnabled,
        get database() { storageReads++; if (storageProbe === 'throw') throw new Error('schema storage reached'); return undefined as unknown as CmsDatabase; } };
    }
    return input.resolve(event, options);
  } });
  options.hooks.handle = handle;
  const http = createServer(async (incoming, outgoing) => {
    try {
      const address = http.address(); assert.ok(address && typeof address === 'object');
      const pathname = new URL(incoming.url ?? '/', `http://127.0.0.1:${address.port}`).pathname;
      if (pathname.startsWith(`${base}/_app/`) && !pathname.startsWith(`${base}/_app/remote/`)) {
        const root = resolve(output, 'client');
        const path = resolve(root, `.${decodeURIComponent(pathname.slice(base.length))}`);
        if (!path.startsWith(root + sep)) { outgoing.writeHead(400); outgoing.end(); return; }
        const body = await readFile(path);
        outgoing.writeHead(200, { 'content-type': path.endsWith('.js') ? 'text/javascript' : path.endsWith('.css') ? 'text/css' : 'application/octet-stream' });
        outgoing.end(body); return;
      }
      const headers = new Headers();
      for (const [key, value] of Object.entries(incoming.headers)) if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
      const request = new Request(`http://127.0.0.1:${address.port}${incoming.url}`, {
        method: incoming.method, headers,
        ...(incoming.method === 'GET' || incoming.method === 'HEAD' ? {} : { body: Readable.toWeb(incoming), duplex: 'half' })
      } as RequestInit);
      const response = await server.respond(request, { getClientAddress: () => '127.0.0.1' });
      outgoing.writeHead(response.status, Object.fromEntries(response.headers));
      outgoing.end(Buffer.from(await response.arrayBuffer()));
    } catch (error) { outgoing.writeHead(500); outgoing.end(String(error)); }
  });
  await new Promise<void>(resolve => http.listen(0, '127.0.0.1', resolve));
  const address = http.address(); assert.ok(address && typeof address === 'object');
  const origin = `http://127.0.0.1:${address.port}`;
  async function request(path: string, session: string | null = 'admin', init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    if (session) headers.set('cookie', `cms-session=${tokens[session] ?? session}`);
    return fetch(new URL(`${base}${path}`, origin), { ...init, headers, signal: AbortSignal.timeout(10_000) });
  }
  async function remote(name: string, session: string | null = 'admin', input?: Record<string, string>, argument?: unknown) {
    assert.ok(ids.has(name), `registered remote: ${name}`);
    const suffix = argument === undefined ? '' : `?payload=${Buffer.from(stringify(argument)).toString('base64url')}`;
    const response = await request(`/_app/remote/${ids.get(name)}${suffix}`, session, input ? {
      method: 'POST', headers: { origin }, body: new URLSearchParams(input)
    } : {});
    assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'private, no-store');
    return response.json();
  }
  return {
    ids, origin, base, tokens, request, remote,
    probeStorage(mode: 'throw' | 'absent' = 'throw') { storageProbe = mode; storageReads = 0; },
    get storageReads() { return storageReads; },
    get database() { return storage.database; },
    get registry() { return new SchemaRegistry(storage.database); },
    async query(name: string, argument?: unknown, session: string | null = 'admin') {
      const result = await remote(name, session, undefined, argument); assert.equal(result.type, 'result', JSON.stringify(result)); return parse(result.data)._;
    },
    async mutate(name: string, input: Record<string, string>, session: string | null = 'admin') {
      const result = await remote(name, session, input); assert.equal(result.type, 'result', JSON.stringify(result));
      const data = parse(result.data); assert.equal(data._.issues, undefined, JSON.stringify(data._.issues)); assert.equal(data._.submission, true); return data;
    },
    async snapshot() {
      return {
        collections: await storage.database.db.selectFrom('_cms_collections').selectAll().orderBy('slug').execute(),
        fields: await storage.database.db.selectFrom('_cms_fields').selectAll().orderBy('slug').execute(),
        guards: await storage.database.db.selectFrom('_cms_guards').selectAll().execute(),
        ddl: (await sql`SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name`.execute(storage.database.db)).rows
      };
    },
    async restart() {
      await storage.close(); storage = await schemaAdminStorage(target, directory);
      server = new Server(manifest); await server.init({ env: {} }); options.hooks.handle = handle;
    },
    async close() {
      await new Promise<void>((resolve,reject) => http.close(error => error ? reject(error) : resolve()));
      options.hooks.handle = originalHandle; await storage.close(); await rm(directory, { recursive: true, force: true });
    }
  };
}
