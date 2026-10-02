// Supplemental native Kit transport fixture. No fixture hook or route enters the app build.
import { cp, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { openSqlite } from '../../src/lib/server/database/sqlite.ts';
import { migrateCms } from '../../src/lib/server/database/migrations.ts';
import { SchemaRegistry } from '../../src/lib/server/database/registry.ts';
import { cmsService } from '../../src/lib/server/database/service.ts';
import { withRevision } from '../../src/lib/server/content/schema.ts';

const checkout = fileURLToPath(new URL('../../', import.meta.url));
/** @type {import('../../src/lib/server/database/service.ts').ServerPrincipal} */
const principal = {
  id: 'trash_fields_author',
  permissions: ['content:read', 'content:read_drafts', 'content:create', 'content:edit_own', 'content:delete_own']
};

export async function createTrashRestoreFieldsServer() {
  const nodeTarget = process.env.SVELTERY_BROWSER_TARGET === 'node';
  // Other browser fixtures use Vite dev servers, which can set the worker's NODE_ENV.
  // This fixture verifies production Kit behavior, including its production-only hidden-field probe.
  const fixtureEnvironment = { ...process.env, NODE_ENV: 'production' };
  const directory = await mkdtemp(join(tmpdir(), 'cms-trash-fields-'));
  const databasePath = join(directory, 'content.sqlite');
  /** @type {import('node:child_process').ChildProcess | undefined} */
  let server;
  /** @type {import('node:child_process').ChildProcess | undefined} */
  let build;
  async function close() {
    if (build && build.exitCode === null) {
      build.kill('SIGTERM');
      const activeBuild = build;
      await new Promise(resolve => activeBuild.once('exit', resolve));
    }
    if (server && server.exitCode === null) {
      server.kill('SIGTERM');
      const activeServer = server;
      await new Promise(resolve => activeServer.once('exit', resolve));
    }
    await rm(directory, { recursive: true, force: true });
  }
  try {
    const seed = openSqlite(databasePath);
    /** @type {Record<string, { collection: string, id: string, locale: string, _rev: string }>} */
    const inputs = {};
    try {
      await migrateCms(seed);
      const registry = new SchemaRegistry(seed);
      await registry.createCollection({ slug: 'post', label: 'Post' });
      await registry.createField('post', { slug: 'title', label: 'Title', type: 'string' });
      const service = cmsService(seed, principal);
      for (const name of ['native', 'enhanced', 'missing']) {
        const entry = await service.createDraft({ type: 'post', data: { title: name } });
        await service.deleteDraft({ type: 'post', id: entry.id, locale: entry.locale,
          expected: { version: entry.version, updatedAt: entry.updatedAt } });
        const trashed = withRevision(await service.getTrashedDraft({ type: 'post', id: entry.id, locale: entry.locale }));
        inputs[name] = { collection: 'post', id: trashed.id, locale: trashed.locale, _rev: trashed._rev };
      }
    } finally {
      await seed.close();
    }
    await Promise.all([
      cp(join(checkout, 'src'), join(directory, 'src'), { recursive: true }),
      cp(join(checkout, 'package.json'), join(directory, 'package.json')),
      cp(join(checkout, 'tsconfig.json'), join(directory, 'tsconfig.json')),
      symlink(join(checkout, 'node_modules'), join(directory, 'node_modules'), 'dir')
    ]);
    await writeFile(join(directory, 'vite.config.ts'), `
import adapter from '@sveltejs/adapter-auto';
import node from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
export default { plugins: [sveltekit({
  preprocess: vitePreprocess(), adapter: ${nodeTarget ? "node({ out: 'build/node' })" : 'adapter()'}, experimental: { remoteFunctions: true },
  compilerOptions: { experimental: { async: true } }
})] };
`);
    await writeFile(join(directory, 'src/hooks.server.ts'), `
import { openSqlite } from '$lib/server/database/sqlite';
const database = openSqlite(${JSON.stringify(databasePath)});
export const handle = ({ event, resolve }) => {
  event.locals.cms = { database, mutationsEnabled: true,
    principal: event.cookies.get('trash-fields-session') === 'author' ? ${JSON.stringify(principal)} : null };
  return resolve(event);
};
`);
    await writeFile(join(directory, 'src/routes/+page.server.ts'), `
const inputs = ${JSON.stringify(inputs)};
export const load = ({ url }) => ({
  input: inputs[url.searchParams.get('case')] ?? inputs.native,
  missing: url.searchParams.has('missing')
});
`);
    await writeFile(join(directory, 'src/routes/+page.svelte'), `
<script lang="ts">
  import { onMount } from 'svelte';
  import { restoreContent } from '$lib/content.remote';
  let { data } = $props();
  restoreContent.fields.set(data.input);
  onMount(() => { document.body.dataset.hydrated = 'true'; });
</script>
<h1>Isolated native restore fields</h1>
<form {...restoreContent}>
  {#if data.missing}
    <input {...restoreContent.fields.collection.as('hidden')} />
    <input {...restoreContent.fields.id.as('hidden')} />
    <input {...restoreContent.fields.locale.as('hidden')} />
    <input {...restoreContent.fields._rev.as('hidden')} />
  {:else}
    <input {...restoreContent.fields.collection.as('hidden', data.input.collection)} />
    <input {...restoreContent.fields.id.as('hidden', data.input.id)} />
    <input {...restoreContent.fields.locale.as('hidden', data.input.locale)} />
    <input {...restoreContent.fields._rev.as('hidden', data.input._rev)} />
  {/if}
  <button>Restore draft</button>
</form>
{#each restoreContent.fields.allIssues() ?? [] as issue}
  <p role="alert" data-path={issue.path.join('.')}>{issue.message}</p>
{/each}
{#if restoreContent.result}<output>{JSON.stringify(restoreContent.result)}</output>{/if}
`);
    let buildOutput = '';
    const buildProcess = spawn(process.execPath, [join(checkout, 'node_modules/vite/bin/vite.js'), 'build'], {
      cwd: directory, stdio: ['ignore', 'pipe', 'pipe'], env: fixtureEnvironment
    });
    build = buildProcess;
    for (const stream of [buildProcess.stdout, buildProcess.stderr]) stream?.on('data', chunk => { buildOutput = (buildOutput + chunk).slice(-20_000); });
    const result = await new Promise((resolve, reject) => { buildProcess.once('exit', resolve); buildProcess.once('error', reject); });
    if (result !== 0) throw new Error(`Native restore fixture build failed (${result}):\n${buildOutput}`);
    await writeFile(join(directory, 'preview-runner.mjs'), nodeTarget ? `
import { createServer } from 'node:http';
const server = createServer();
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = 'http://127.0.0.1:' + server.address().port;
process.env.ORIGIN = origin;
const { handler } = await import('./build/node/handler.js');
server.on('request', handler);
process.on('SIGTERM', () => { server.closeIdleConnections(); server.close(() => process.exit()); });
process.send(origin + '/');
` : `
import { preview } from 'vite';
const server = await preview({ preview: { host: '127.0.0.1', port: 0 }, clearScreen: false, logLevel: 'error' });
process.send(server.resolvedUrls.local[0]);
`);
    const previewProcess = spawn(process.execPath, ['preview-runner.mjs'], {
      cwd: directory, stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      env: { ...fixtureEnvironment, ...(nodeTarget ? { HOST: '127.0.0.1', PORT: '0' } : {}) }
    });
    server = previewProcess;
    for (const stream of [previewProcess.stdout, previewProcess.stderr]) stream?.on('data', chunk => { buildOutput = (buildOutput + chunk).slice(-20_000); });
    /** @type {Promise<string>} */
    const started = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Native restore fixture startup timed out:\n${buildOutput}`)), 15_000);
      previewProcess.once('message', value => { clearTimeout(timer); resolve(String(value)); });
      previewProcess.once('error', error => { clearTimeout(timer); reject(error); });
      previewProcess.once('exit', code => { clearTimeout(timer); reject(new Error(`Native restore fixture exited (${code}):\n${buildOutput}`)); });
    });
    const baseURL = await started;
    const { manifest } = await import(pathToFileURL(join(directory, '.svelte-kit/output/server/manifest.js')).href);
    const ids = new Map();
    for (const [hash, load] of Object.entries(manifest._.remotes)) {
      const { default: exports } = await load();
      for (const name of Object.keys(exports)) ids.set(name, `${hash}/${name}`);
    }
    return { baseURL, inputs, ids, close };
  } catch (error) {
    await close();
    throw error;
  }
}
