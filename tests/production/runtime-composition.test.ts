// Supplemental native application composition checks. No upstream declarations credited.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse, stringify } from 'devalue';
import { encodeBase64urlNoPadding } from '@oslojs/encoding';
import { openSqlite } from '../../src/lib/server/database/sqlite.ts';
import { SchemaRegistry } from '../../src/lib/server/database/registry.ts';
import { hashSessionToken } from '../../src/lib/server/auth/session.ts';
import { Role } from '../../src/lib/server/auth/roles.ts';

test('built application hooks compose configured persistent storage and real stored sessions without a replacement test hook', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'cms-runtime-built-'));
  const path = join(directory, 'data.db');
  const built = (file: string) => import(new URL(`../../.svelte-kit/output/server/${file}`, import.meta.url).href);
  const { manifest } = await built('manifest.js');
  const { Server } = await built('index.js');
  const server = new Server(manifest);
  await server.init({ env: { SVELTERY_DATABASE_PATH: path, SVELTERY_PUBLIC_ORIGIN: 'http://cms.test' } });
  const ids = new Map<string, string>();
  for (const [hash, load] of Object.entries(manifest._.remotes)) {
    const { default: exports } = await (load as () => Promise<{ default: Record<string, unknown> }>)();
    for (const name of Object.keys(exports)) ids.set(name, `${hash}/${name}`);
  }
  const token = encodeBase64urlNoPadding(crypto.getRandomValues(new Uint8Array(32)));
  async function remote(name: string, authenticated = false, argument?: unknown, input?: Record<string, string>) {
    assert.ok(ids.has(name));
    const suffix = argument === undefined ? '' : `?payload=${Buffer.from(stringify(argument)).toString('base64url')}`;
    const response = await server.respond(new Request(`http://cms.test/_app/remote/${ids.get(name)}${suffix}`, {
      ...(input ? { method: 'POST', body: new URLSearchParams(input) } : {}),
      headers: { origin: 'http://cms.test', ...(authenticated ? { cookie: `cms-session=${token}` } : {}) }
    }), { getClientAddress: () => '127.0.0.1' });
    assert.equal(response.status, 200);
    return response.json();
  }
  let operator: ReturnType<typeof openSqlite> | undefined;
  try {
    const denied = await remote('getEditorManifest');
    assert.equal(denied.status, 401);
    assert.equal(denied.error.code, 'UNAUTHENTICATED');
    assert.ok((await stat(path)).size > 0);
    operator = openSqlite(path);
    const registry = new SchemaRegistry(operator);
    await registry.createCollection({ slug: 'notes', label: 'Notes' });
    await registry.createField('notes', { slug: 'headline', label: 'Headline', type: 'string', required: true });
    await operator.db.insertInto('_cms_auth_users').values({ id: 'real-session-user', role: Role.AUTHOR, disabled: 0 }).execute();
    await operator.db.insertInto('_cms_auth_sessions').values({ hash: (await hashSessionToken(token))!, user_id: 'real-session-user', expires_at: Date.now() + 60_000 }).execute();
    const editor = await remote('getEditorManifest', true);
    assert.equal(editor.type, 'result');
    assert.equal(parse(editor.data)._.collections.notes.fields.headline.label, 'Headline');
    const created = await remote('createContent', true, undefined, { collection: 'notes', 'data.headline': 'Configured real hook' });
    assert.equal(created.type, 'result');
    const receipt = parse(created.data)._.result;
    assert.ok(receipt.id);
    const content = await remote('getContent', true, { collection: 'notes', id: receipt.id });
    assert.equal(parse(content.data)._.data.headline, 'Configured real hook');
    assert.equal(parse(content.data)._.authorId, 'real-session-user');
    await operator.db.updateTable('_cms_auth_users').set({ disabled: 1 }).where('id', '=', 'real-session-user').execute();
    const disabled = await remote('getEditorManifest', true);
    assert.equal(disabled.status, 401);
    assert.equal(disabled.error.code, 'UNAUTHENTICATED');
  } finally {
    await operator?.close();
    // Server exposes no disposal API; the isolated test process owns its application adapter lifetime.
    await rm(directory, { recursive: true, force: true });
  }
});
