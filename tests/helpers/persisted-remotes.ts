import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse, stringify } from 'devalue';
import type { Handle } from '@sveltejs/kit';
import { openSqlite } from '../../src/lib/server/database/sqlite.ts';
import { migrateCms } from '../../src/lib/server/database/migrations.ts';
import { SchemaRegistry } from '../../src/lib/server/database/registry.ts';
import { DraftRepository } from '../../src/lib/server/database/entries.ts';
import { createCmsHandle } from '../../src/lib/server/auth/composition.ts';
import { hashSessionToken, revokeSession } from '../../src/lib/server/auth/session.ts';
import { createKyselySessionStore } from '../../src/lib/server/auth/store.ts';
import { encodeBase64urlNoPadding } from '@oslojs/encoding';
import { Role } from '../../src/lib/server/auth/roles.ts';
import type { ServerPrincipal } from '../../src/lib/server/database/service.ts';

export const sessions: Record<string, ServerPrincipal> = {
  author: { id: 'user_author', permissions: ['schema:read', 'content:read', 'content:read_drafts', 'content:create', 'content:edit_own', 'content:delete_own'] },
  other: { id: 'user_other', permissions: ['content:read', 'content:read_drafts', 'content:create', 'content:edit_own', 'content:delete_own'] },
  editor: { id: 'user_editor', permissions: ['schema:read', 'content:read', 'content:read_drafts', 'content:create', 'content:edit_any', 'content:delete_any'] },
  writer: { id: 'user_writer', permissions: ['content:create', 'content:edit_any', 'content:delete_any'] },
  reader: { id: 'user_reader', permissions: ['content:read', 'content:read_drafts'] }
};

/** Isolated built-server test hook. This file is never imported by app source. */
export async function persistedRemotes(config?: { persistedSessions: true; mutationsEnabled?: boolean }) {
  let mutationsEnabled = config?.mutationsEnabled ?? true;
  const directory = await mkdtemp(join(tmpdir(), 'cms-remotes-'));
  const path = join(directory, 'content.sqlite');
  let database = openSqlite(path);
  await migrateCms(database);
  const registry = new SchemaRegistry(database);
  for (const slug of ['post', 'page']) {
    await registry.createCollection({ slug, label: slug });
    await registry.createField(slug, { slug: 'title', label: 'Title', type: 'string' });
  }
  await registry.createCollection({ slug: 'notes', label: 'Notes' });
  await registry.createField('notes', { slug: 'headline', label: 'Headline', type: 'string', required: true, validation: { minLength: 1, maxLength: 100 } });
  await registry.createField('notes', { slug: 'detail', label: 'Detail', type: 'text' });
  const tokens: Record<string, string> = {};
  if (config?.persistedSessions) {
    for (const [name, role] of Object.entries({ author: Role.AUTHOR, other: Role.AUTHOR, editor: Role.EDITOR, admin: Role.ADMIN, contributor: Role.CONTRIBUTOR, subscriber: Role.SUBSCRIBER })) {
      tokens[name] = encodeBase64urlNoPadding(crypto.getRandomValues(new Uint8Array(32)));
      await database.db.insertInto('_cms_auth_users').values({ id: `user_${name}`, role, disabled: 0 }).execute();
      await database.db.insertInto('_cms_auth_sessions').values({ hash: (await hashSessionToken(tokens[name]))!, user_id: `user_${name}`, expires_at: Date.now() + 60_000 }).execute();
    }
  }
  const built = (file: string) => import(new URL(`../../.svelte-kit/output/server/${file}`, import.meta.url).href);
  const { manifest } = await built('manifest.js');
  const { Server } = await built('index.js');
  const { options } = await built('internal.js');
  let server = new Server(manifest);
  await server.init({ env: {} });
  const ids = new Map<string, string>();
  for (const [hash, load] of Object.entries(manifest._.remotes)) {
    const { default: exports } = await (load as () => Promise<{ default: Record<string, unknown> }>)();
    for (const name of Object.keys(exports)) ids.set(name, `${hash}/${name}`);
  }
  const originalHandle = options.hooks.handle;
  const handle: Handle = config?.persistedSessions ? createCmsHandle(() => ({ database, mutationsEnabled })) : ({ event, resolve }) => {
    const sid = event.cookies.get('cms-test-session');
    // Opaque cookie -> trusted server session. No role/permission/header claims.
    const principal = sid ? sessions[sid] ?? null : null;
    Object.assign(event.locals, { cms: { database, principal, mutationsEnabled } });
    return resolve(event);
  };
  options.hooks.handle = handle;
  async function request(url: string, session: string | null, init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    if (session) headers.set('cookie', config?.persistedSessions ? `cms-session=${tokens[session] ?? session}` : `cms-test-session=${session}`);
    return server.respond(new Request(`http://cms.test${url}`, { ...init, headers }), { getClientAddress: () => '127.0.0.1' });
  }
  async function remote(name: string, session: string | null, input?: Record<string, string>, argument?: unknown) {
    assert.ok(ids.has(name), `registered remote: ${name}`);
    const suffix = argument === undefined ? '' : `?payload=${Buffer.from(stringify(argument)).toString('base64url')}`;
    const response = await request(`/_app/remote/${ids.get(name)}${suffix}`, session, input ? {
      method: 'POST', headers: { origin: 'http://cms.test' }, body: new URLSearchParams(input)
    } : {});
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    return response.json();
  }
  return {
    ids, registry, request, remote,
    setMutationsEnabled(value: boolean) { mutationsEnabled = value; },
    async setRole(session: string, role: number) { await database.db.updateTable('_cms_auth_users').set({ role }).where('id', '=', `user_${session}`).execute(); },
    async disable(session: string) { await database.db.updateTable('_cms_auth_users').set({ disabled: 1 }).where('id', '=', `user_${session}`).execute(); },
    async expire(session: string) { await database.db.updateTable('_cms_auth_sessions').set({ expires_at: Date.now() - 1 }).where('hash', '=', (await hashSessionToken(tokens[session]))!).execute(); },
    async revoke(session: string) { await revokeSession(tokens[session], createKyselySessionStore(database.db.$pickTables<'_cms_auth_users' | '_cms_auth_sessions'>())); },
    get database() { return database; },
    get repository() { return new DraftRepository(database); },
    async query(name: string, argument: unknown, session: string | null = 'author') {
      const result = await remote(name, session, undefined, argument);
      assert.equal(result.type, 'result', JSON.stringify(result));
      return parse(result.data)._;
    },
    async mutate(name: string, input: Record<string, string>, session: string | null = 'author') {
      const result = await remote(name, session, input);
      assert.equal(result.type, 'result', JSON.stringify(result));
      const data = parse(result.data);
      assert.equal(data._.issues, undefined, JSON.stringify(data._.issues));
      assert.equal(data._.submission, true);
      return data;
    },
    async mutateWithRefreshes(name: string, input: Record<string, unknown>, keys: string[], session = 'author') {
      const header = new TextEncoder().encode(stringify([input, { remote_refreshes: keys }]));
      const offsets = new TextEncoder().encode('[]');
      const prefix = new Uint8Array(7);
      new DataView(prefix.buffer).setUint32(1, header.length, true);
      new DataView(prefix.buffer).setUint16(5, offsets.length, true);
      const response = await request(`/_app/remote/${ids.get(name)}`, session, {
        method: 'POST', headers: { origin: 'http://cms.test', 'content-type': 'application/x-sveltekit-formdata' },
        body: new Blob([prefix, header, offsets])
      });
      assert.equal(response.status, 200);
      const result = await response.json();
      assert.equal(result.type, 'result');
      return parse(result.data);
    },
    async restart() {
      await database.close();
      database = openSqlite(path);
      server = new Server(manifest);
      await server.init({ env: {} });
      options.hooks.handle = handle;
    },
    async close() { options.hooks.handle = originalHandle; await database.close(); await rm(directory, { recursive: true, force: true }); }
  };
}

export const fields = (data: Record<string, string>) => Object.fromEntries(Object.entries(data).map(([key, value]) => [`data.${key}`, value]));
