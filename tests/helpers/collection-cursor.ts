import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { encodeBase64urlNoPadding } from '@oslojs/encoding';
import { openSqlite } from '../../src/lib/server/database/sqlite.ts';
import { migrateCms } from '../../src/lib/server/database/migrations.ts';
import { SchemaRegistry } from '../../src/lib/server/database/registry.ts';
import { DraftRepository } from '../../src/lib/server/database/entries.ts';
import { createCmsHandle } from '../../src/lib/server/auth/composition.ts';
import { hashSessionToken } from '../../src/lib/server/auth/session.ts';
import { Role } from '../../src/lib/server/auth/roles.ts';

// Test-only persisted fixture; no app hook, production writes or live credentials.
export async function collectionCursorFixture(output = fileURLToPath(new URL('../../.svelte-kit/output/', import.meta.url))) {
  const directory = await mkdtemp(join(tmpdir(), 'cms-cursor-data-'));
  const path = join(directory, 'content.sqlite');
  let database = openSqlite(path);
  await migrateCms(database);
  const registry = new SchemaRegistry(database);
  for (const slug of ['post', 'page', 'empty']) {
    await registry.createCollection({ slug, label: slug });
    await registry.createField(slug, { slug: 'title', label: 'Title', type: 'string' });
  }
  const repository = new DraftRepository(database);
  const items = [];
  for (let index = 0; index < 103; index++) {
    items.push(await repository.create({ type: 'post', data: { title: `Draft ${index}` }, slug: `draft-${index}` }, 'user_author'));
  }
  await repository.create({ type: 'page', data: { title: 'Other collection' } }, 'user_author');
  const tokens: Record<string, string> = {};
  for (const [name, role] of Object.entries({ author: Role.AUTHOR, subscriber: Role.SUBSCRIBER })) {
    tokens[name] = encodeBase64urlNoPadding(crypto.getRandomValues(new Uint8Array(32)));
    await database.db.insertInto('_cms_auth_users').values({ id: `user_${name}`, role, disabled: 0 }).execute();
    await database.db.insertInto('_cms_auth_sessions').values({ hash: (await hashSessionToken(tokens[name]))!, user_id: `user_${name}`, expires_at: Date.now() + 600_000 }).execute();
  }
  const built = (file: string) => import(pathToFileURL(join(output, 'server', file)).href);
  const { manifest } = await built('manifest.js');
  const { Server } = await built('index.js');
  const { options } = await built('internal.js');
  const handle = createCmsHandle(() => ({ database }));
  let server = new Server(manifest);
  await server.init({ env: {} });
  const originalHandle = options.hooks.handle;
  options.hooks.handle = handle;
  return {
    output, items, tokens, manifest,
    respond(request: Request) { return server.respond(request, { getClientAddress: () => '127.0.0.1' }); },
    async restart() {
      await database.close();
      database = openSqlite(path);
      server = new Server(manifest);
      await server.init({ env: {} });
      options.hooks.handle = handle;
    },
    async close() {
      options.hooks.handle = originalHandle;
      await database.close();
      await rm(directory, { recursive: true, force: true });
    }
  };
}
