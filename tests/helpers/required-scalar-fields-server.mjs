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
import { sql } from 'kysely';
import { withRevision } from '../../src/lib/server/content/schema.ts';

const checkout = fileURLToPath(new URL('../../', import.meta.url));
/** @type {import('../../src/lib/server/database/service.ts').ServerPrincipal} */
const principal = {
  id: 'scalar_fields_author',
  permissions: ['content:read', 'content:read_drafts', 'content:create', 'content:edit_own', 'content:delete_own']
};

export async function createRequiredScalarFieldsServer() {
  const nodeTarget = process.env.SVELTERY_BROWSER_TARGET === 'node';
  // Other browser fixtures use Vite dev servers, which can set the worker's NODE_ENV.
  // This fixture verifies production Kit behavior, including direct field descriptor spreads.
  const fixtureEnvironment = { ...process.env, NODE_ENV: 'production' };
  const directory = await mkdtemp(join(tmpdir(), 'cms-required-scalar-'));
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
      await registry.createCollection({ slug: 'scalars', label: 'Scalars' });
      await registry.createField('scalars', { slug: 'string', label: 'Required string', type: 'string', required: true, defaultValue: 'Metadata default', validation: { minLength: 0 } });
      await registry.createField('scalars', { slug: 'text', label: 'Required text', type: 'text', required: true, defaultValue: '', validation: { minLength: 0 } });
      await registry.createField('scalars', { slug: 'optional', label: 'Optional text', type: 'text', defaultValue: 'Optional default' });
      await registry.createCollection({ slug: 'legacy', label: 'Legacy' });
      for (const type of ['string', 'text']) await registry.createField('legacy', { slug: type, label: 'Legacy ' + type, type, defaultValue: 'Legacy fallback' });
      await registry.createField('legacy', { slug: 'detail', label: 'Detail', type: 'text' });
      const service = cmsService(seed, principal);
      const legacy = await service.createDraft({ type: 'legacy', data: { string: '', text: null, detail: 'Old detail' } });
      await sql`UPDATE _cms_fields SET required = 1 WHERE collection_id = (SELECT id FROM _cms_collections WHERE slug = 'legacy') AND slug IN ('string', 'text')`.execute(seed.db);
      inputs.legacy = { collection: 'legacy', ...withRevision(legacy) };
    } finally {
      await seed.close();
    }
    await Promise.all([
      cp(join(checkout, 'src'), join(directory, 'src'), { recursive: true }),
      cp(join(checkout, 'package.json'), join(directory, 'package.json')),
      cp(join(checkout, 'tsconfig.json'), join(directory, 'tsconfig.json')),
      cp(join(checkout, 'scripts/source-seed-vite.ts'), join(directory, 'scripts/source-seed-vite.ts')),
      cp(join(checkout, 'scripts/source-seed-virtual-module.ts'), join(directory, 'scripts/source-seed-virtual-module.ts')),
      symlink(join(checkout, 'node_modules'), join(directory, 'node_modules'), 'dir')
    ]);
    await writeFile(join(directory, 'vite.config.ts'), `
import adapter from '@sveltejs/adapter-auto';
import node from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { sourceSeedPlugin } from './scripts/source-seed-vite.ts';
export default { plugins: [sourceSeedPlugin(), sveltekit({
  preprocess: vitePreprocess(), adapter: ${nodeTarget ? "node({ out: 'build/node' })" : 'adapter()'}, experimental: { remoteFunctions: true },
  compilerOptions: { experimental: { async: true } }
})] };
`);
    await writeFile(join(directory, 'src/hooks.server.ts'), `
import { openSqlite } from '$lib/server/database/sqlite';
const database = openSqlite(${JSON.stringify(databasePath)});
export const handle = ({ event, resolve }) => {
  event.locals.cms = { database, ...(event.cookies.get('scalar-fields-write-gate') === 'enabled' ? { mutationsEnabled: true } : {}),
    principal: event.cookies.get('scalar-fields-session') === 'author' ? ${JSON.stringify(principal)} : null };
  return resolve(event);
};
`);
    await writeFile(join(directory, 'src/routes/+page.server.ts'), `
const legacy = ${JSON.stringify(inputs.legacy)};
export const load = ({ url }) => ({ legacy,
  update: url.searchParams.has('update'), empty: url.searchParams.get('empty') ?? 'string'
});
`);
    await writeFile(join(directory, 'src/routes/+page.svelte'), `
<script lang="ts">
  import { onMount } from 'svelte';
  import { createContent, updateContent } from '$lib/content.remote';
  let { data } = $props();
  let failure = $state('');
  const createData = $derived(JSON.stringify({ string: data.empty === 'string' ? '' : 'Valid', text: data.empty === 'text' ? '' : 'Valid' }));
  const updateData = $derived(JSON.stringify(data.empty === 'detail' ? { detail: 'Changed detail' } : { [data.empty]: '' }));
  onMount(() => { document.body.dataset.hydrated = 'true'; });
  async function submit({ submit }) { failure = ''; try { await submit(); } catch (error) { failure = error.body?.code ?? 'UNEXPECTED'; } }
</script>
<h1>Isolated required scalar descriptors</h1>
{#if data.update}
  <form {...updateContent.enhance(submit)}>
    <input {...updateContent.fields.collection.as('hidden', 'legacy')} />
    <input {...updateContent.fields.id.as('hidden', data.legacy.id)} />
    <input {...updateContent.fields._rev.as('hidden', data.legacy._rev)} />
    <input {...updateContent.fields.data.as('hidden', updateData)} />
    <button>Update draft</button>
  </form>
  {#if updateContent.result}<output>{JSON.stringify(updateContent.result)}</output>{/if}
{:else}
  <form {...createContent.enhance(submit)}>
    <input {...createContent.fields.collection.as('hidden', 'scalars')} />
    <input {...createContent.fields.data.as('hidden', createData)} />
    <button>Create draft</button>
  </form>
  {#if createContent.result}<output>{JSON.stringify(createContent.result)}</output>{/if}
{/if}
{#if failure}<p role="alert">{failure}</p>{/if}
`);
    let buildOutput = '';
    const buildProcess = spawn(process.execPath, [join(checkout, 'node_modules/vite/bin/vite.js'), 'build'], {
      cwd: directory, stdio: ['ignore', 'pipe', 'pipe'], env: fixtureEnvironment
    });
    build = buildProcess;
    for (const stream of [buildProcess.stdout, buildProcess.stderr]) stream?.on('data', chunk => { buildOutput = (buildOutput + chunk).slice(-20_000); });
    const result = await new Promise((resolve, reject) => { buildProcess.once('exit', resolve); buildProcess.once('error', reject); });
    if (result !== 0) throw new Error(`Required scalar fixture build failed (${result}):\n${buildOutput}`);
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
      const timer = setTimeout(() => reject(new Error(`Required scalar fixture startup timed out:\n${buildOutput}`)), 15_000);
      previewProcess.once('message', value => { clearTimeout(timer); resolve(String(value)); });
      previewProcess.once('error', error => { clearTimeout(timer); reject(error); });
      previewProcess.once('exit', code => { clearTimeout(timer); reject(new Error(`Required scalar fixture exited (${code}):\n${buildOutput}`)); });
    });
    const baseURL = await started;
    const { manifest } = await import(pathToFileURL(join(directory, '.svelte-kit/output/server/manifest.js')).href);
    const ids = new Map();
    for (const [hash, load] of Object.entries(manifest._.remotes)) {
      const { default: exports } = await load();
      for (const name of Object.keys(exports)) ids.set(name, `${hash}/${name}`);
    }
    return { baseURL, inputs, ids, databasePath, close };
  } catch (error) {
    await close();
    throw error;
  }
}
