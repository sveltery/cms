import { cp, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { sql } from 'kysely';
import { encodeBase64urlNoPadding } from '@oslojs/encoding';
import { openSqlite } from '../../src/lib/server/database/sqlite.ts';
import { migrateCms } from '../../src/lib/server/database/migrations.ts';
import { SchemaRegistry } from '../../src/lib/server/database/registry.ts';
import { DraftRepository } from '../../src/lib/server/database/entries.ts';
import { createCmsHandle } from '../../src/lib/server/auth/composition.ts';
import { hashSessionToken } from '../../src/lib/server/auth/session.ts';
import { Role } from '../../src/lib/server/auth/roles.ts';

// Shared isolated /cms build for native SSR and browser pagination evidence.
export async function collectionTrashOutput(base: '' | '/cms') {
  const checkout = fileURLToPath(new URL('../../', import.meta.url));
  if (!base) return { output: join(checkout, '.svelte-kit/output'), async close() {} };
  const directory = await mkdtemp(join(tmpdir(), 'cms-trash-base-'));
  try {
    await Promise.all([
      cp(join(checkout, 'src'), join(directory, 'src'), { recursive: true }),
      cp(join(checkout, 'package.json'), join(directory, 'package.json')),
      cp(join(checkout, 'tsconfig.json'), join(directory, 'tsconfig.json')),
      symlink(join(checkout, 'node_modules'), join(directory, 'node_modules'), 'dir')
    ]);
    const nodeTarget = process.env.SVELTERY_BROWSER_TARGET === 'node';
    await writeFile(join(directory, 'vite.config.ts'), `
import adapter from '@sveltejs/adapter-${nodeTarget ? 'node' : 'auto'}';
import { sveltekit } from '@sveltejs/kit/vite';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
export default { plugins: [sveltekit({ preprocess: vitePreprocess(), adapter: adapter(),
  paths: { base: '/cms' }, experimental: { remoteFunctions: true },
  compilerOptions: { experimental: { async: true } }
})] };
`);
    const child = spawn(process.execPath, [join(checkout, 'node_modules/vite/bin/vite.js'), 'build'], { cwd: directory, stdio: 'pipe' });
    let diagnostics = '';
    child.stdout.on('data', chunk => { diagnostics += chunk; });
    child.stderr.on('data', chunk => { diagnostics += chunk; });
    const result = await new Promise(resolve => child.once('exit', resolve));
    if (result !== 0) throw new Error(`Isolated trash build failed (${result}): ${diagnostics}`);
    return { output: join(directory, '.svelte-kit/output'), close: () => rm(directory, { recursive: true, force: true }) };
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}

// Test-only persisted fixture; no app hook, production writes or live credentials.
export async function collectionTrashFixture(output = fileURLToPath(new URL('../../.svelte-kit/output/', import.meta.url)),
  configuration: { mutationsEnabled?: boolean; restoreEntries?: boolean } = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'cms-trash-data-'));
  const path = join(directory, 'content.sqlite');
  let database = openSqlite(path);
  await migrateCms(database);
  const registry = new SchemaRegistry(database);
  for (const slug of ['post', 'page', 'empty', 'untitled']) {
    await registry.createCollection({ slug, label: slug });
    if (slug !== 'untitled') await registry.createField(slug, { slug: 'title', label: 'Title', type: 'text' });
    await registry.createField(slug, { slug: 'body', label: 'Body', type: 'text' });
  }
  const repository = new DraftRepository(database);
  const items = [];
  for (let index = 0; index < 103; index++) {
    const item = await repository.create({ type: 'post', locale: index % 2 ? 'fr' : 'en',
      data: { title: index === 102 ? '<img src=x onerror=alert(1)> & title' : index === 101 ? ''
        : index === 100 ? null : index === 99 ? 'T'.repeat(230) : `Trashed ${index}`,
        body: 'PRIVATE_BODY_MARKER' }, ...(index === 101 ? { slug: 'fallback-slug' } : {}) }, 'user_other');
    // Fixed deletion times include ties; expected order is independently derived below.
    const deletedAt = new Date(Date.UTC(2026, 8, 1 + Math.floor(index / 2), 23, 30)).toISOString();
    await sql`UPDATE ec_post SET deleted_at = ${deletedAt} WHERE id = ${item.id}`.execute(database.db);
    items.push({ ...item, deletedAt });
  }
  const fullExpected = [...items].sort((a, b) => b.deletedAt.localeCompare(a.deletedAt) || b.id.localeCompare(a.id));
  const expected = fullExpected.slice(0, 50);
  const active = await repository.create({ type: 'post', data: { title: 'Active trash ID', body: 'ACTIVE_BODY_MARKER' } }, 'user_author');
  await sql`UPDATE ec_post SET id = 'trash' WHERE id = ${active.id}`.execute(database.db);
  const other = await repository.create({ type: 'page', locale: 'fr', data: { title: 'Other collection' } }, 'user_other');
  await sql`UPDATE ec_page SET deleted_at = '2026-09-30T00:00:00.000Z' WHERE id = ${other.id}`.execute(database.db);
  const untitled = await repository.create({ type: 'untitled', data: { body: 'UNTITLED_BODY_MARKER' } }, 'user_other');
  await sql`UPDATE ec_untitled SET deleted_at = '2026-09-30T00:00:00.000Z' WHERE id = ${untitled.id}`.execute(database.db);
  const tokens: Record<string, string> = {};
  const restoreItems = [];
  if (configuration.restoreEntries) {
    await registry.createCollection({ slug: 'restore', label: 'Restore fixtures' });
    await registry.createField('restore', { slug: 'title', label: 'Title', type: 'text' });
    for (const [title, locale, author] of [
      ['Restore pair', 'en', 'user_author'], ['Restore pair', 'fr', 'user_author'],
      ['Other owner', 'en', 'user_other'], ['Null owner', 'en', null]
    ] as const) {
      const row = await repository.create({ type: 'restore', locale, data: { title } }, author ?? 'user_other');
      await sql`UPDATE ec_restore SET deleted_at = '2026-09-30T00:00:00.000Z', author_id = ${author}
        WHERE id = ${row.id}`.execute(database.db);
      restoreItems.push(await repository.findTrashedById('restore', row.id, locale));
    }
  }
  for (const [name, role] of Object.entries({ author: Role.AUTHOR, editor: Role.EDITOR, contributor: Role.CONTRIBUTOR, subscriber: Role.SUBSCRIBER })) {
    tokens[name] = encodeBase64urlNoPadding(crypto.getRandomValues(new Uint8Array(32)));
    await database.db.insertInto('_cms_auth_users').values({ id: `user_${name}`, role, disabled: 0 }).execute();
    await database.db.insertInto('_cms_auth_sessions').values({ hash: (await hashSessionToken(tokens[name]))!, user_id: `user_${name}`, expires_at: Date.now() + 600_000 }).execute();
  }
  const built = (file: string) => import(pathToFileURL(join(output, 'server', file)).href);
  const { manifest } = await built('manifest.js');
  const { Server } = await built('index.js');
  const { options } = await built('internal.js');
  const handle = createCmsHandle(() => ({ database, mutationsEnabled: configuration.mutationsEnabled }));
  let server = new Server(manifest);
  await server.init({ env: {} });
  const originalHandle = options.hooks.handle;
  options.hooks.handle = handle;
  return {
    output, items, expected, fullExpected, untitled, tokens, manifest, restoreItems,
    respond(request: Request) { return server.respond(request, { getClientAddress: () => '127.0.0.1' }); },
    async staleRestore(id: string) {
      if (!configuration.restoreEntries) throw new Error('Restore fixtures are not enabled');
      await sql`UPDATE ec_restore SET version = version + 1 WHERE id = ${id}`.execute(database.db);
    },
    async stalePost(id: string) {
      await sql`UPDATE ec_post SET version = version + 1 WHERE id = ${id}`.execute(database.db);
    },
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
