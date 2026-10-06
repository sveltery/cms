// Supplemental native query harness. This page exists only in an isolated test build.
import { cp, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { copyIsolatedRootPageSource } from './isolated-root-page-build.mjs';

export async function trashCountOutput(base: '' | '/cms') {
  const checkout = fileURLToPath(new URL('../../', import.meta.url));
  const directory = await mkdtemp(join(tmpdir(), 'cms-trash-count-'));
  try {
    await Promise.all([
      copyIsolatedRootPageSource(checkout, directory),
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
  paths: { base: ${JSON.stringify(base)} }, experimental: { remoteFunctions: true },
  compilerOptions: { experimental: { async: true } }
})] };
`);
    await writeFile(join(directory, 'src/routes/+page.server.ts'), `
export const load = ({ url }) => ({ input: {
  collection: 'post', locale: 'en', id: url.searchParams.get('id') ?? '', _rev: url.searchParams.get('rev') ?? ''
} });
`);
    await writeFile(join(directory, 'src/routes/+page.svelte'), `
<script lang="ts">
  import { onMount } from 'svelte';
  import { countTrashedContent, restoreContent, deleteContent } from '$lib/content.remote';
  let { data } = $props();
  const scopes = [
    { name: 'all', arg: { collection: 'post' } },
    { name: 'en', arg: { collection: 'post', locale: 'en' } },
    { name: 'fr', arg: { collection: 'post', locale: 'fr' } },
    { name: 'other', arg: { collection: 'page' } },
    { name: 'empty', arg: { collection: 'empty' } }
  ];
  const queries = scopes.map(scope => countTrashedContent(scope.arg));
  const settled = $derived(await Promise.all(queries.map(query => query.catch(() => null))));
  onMount(() => { document.body.dataset.hydrated = 'true'; });
</script>
<h1>Isolated native trash count queries</h1>
{#each scopes as scope, index}
  <output aria-label={scope.name}>{queries[index].error ? 'unavailable' : queries[index].current ?? settled[index]}</output>
{/each}
<form {...restoreContent.enhance(async ({ submit }) => { await submit().updates(...queries); })}>
  <input {...restoreContent.fields.collection.as('hidden', data.input.collection)} />
  <input {...restoreContent.fields.id.as('hidden', data.input.id)} />
  <input {...restoreContent.fields.locale.as('hidden', data.input.locale)} />
  <input {...restoreContent.fields._rev.as('hidden', data.input._rev)} />
  <button disabled={restoreContent.pending > 0 || Boolean(restoreContent.result)}>Restore draft</button>
</form>
{#if restoreContent.result}
  <form {...deleteContent.enhance(async ({ submit }) => { await submit().updates(...queries); })}>
    <input {...deleteContent.fields.collection.as('hidden', restoreContent.result.type)} />
    <input {...deleteContent.fields.id.as('hidden', restoreContent.result.id)} />
    <input {...deleteContent.fields.locale.as('hidden', restoreContent.result.locale)} />
    <input {...deleteContent.fields._rev.as('hidden', restoreContent.result._rev)} />
    <button disabled={deleteContent.pending > 0 || Boolean(deleteContent.result)}>Trash draft</button>
  </form>
{/if}
`);
    const child = spawn(process.execPath, [join(checkout, 'node_modules/vite/bin/vite.js'), 'build'], {
      cwd: directory, stdio: 'pipe', env: { ...process.env, NODE_ENV: 'production' }
    });
    let diagnostics = '';
    child.stdout.on('data', chunk => { diagnostics = (diagnostics + chunk).slice(-20_000); });
    child.stderr.on('data', chunk => { diagnostics = (diagnostics + chunk).slice(-20_000); });
    const result = await new Promise((resolve, reject) => { child.once('exit', resolve); child.once('error', reject); });
    if (result !== 0) throw new Error(`Isolated count build failed (${result}): ${diagnostics}`);
    return { output: join(directory, '.svelte-kit/output'), close: () => rm(directory, { recursive: true, force: true }) };
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}
