import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { compile } from 'svelte/compiler';
import { render } from 'svelte/server';
import type { Component } from 'svelte';
import type { QueryClient } from '@tanstack/query-core';
import { compileWorkspaceAccountSsr } from '../helpers/admin-app/compile-account-ssr.ts';
let directory: string, Root: Component<any>, getClient: () => QueryClient;
before(async () => {
 directory = await mkdtemp(fileURLToPath(new URL('.root-cache-', import.meta.url)));
 await compileWorkspaceAccountSsr(directory);
 const provider = compile(await readFile(new URL('../../src/lib/dashboard/DashboardQueryProvider.svelte', import.meta.url), 'utf8'), { filename: 'DashboardQueryProvider.svelte', generate: 'server' }).js.code.replace('./query.svelte', './dashboard-query.js');
 await writeFile(`${directory}/Provider.js`, provider);
 const layout = compile(await readFile(new URL('../../src/routes/+layout.svelte', import.meta.url), 'utf8'), { filename: '+layout.svelte', generate: 'server' }).js.code.replace('$lib/dashboard/DashboardQueryProvider.svelte', './Provider.js');
 await writeFile(`${directory}/Root.js`, layout);
 ({ default: Root } = await import(`${directory}/Root.js`));
 ({ getDashboardQueryClient: getClient } = await import(`${directory}/dashboard-query.js`));
});
after(async () => { if (directory) await rm(directory, { recursive: true, force: true }); });
test('actual SSR root layouts isolate per-render current-user data', async () => {
 let first!: QueryClient, second!: QueryClient, dataBeforeSecond: unknown;
 await render(Root, { props: { children: () => { first = getClient(); first.setQueryData(['currentUser'], { id: 'ordinary-alice-fixture' }); } } });
 await render(Root, { props: { children: () => { second = getClient(); dataBeforeSecond = second.getQueryData(['currentUser']); second.setQueryData(['currentUser'], { id: 'ordinary-bob-fixture' }); } } });
 assert.notEqual(first, second); assert.equal(dataBeforeSecond, undefined);
 assert.deepEqual(first.getQueryData(['currentUser']), { id: 'ordinary-alice-fixture' });
 assert.deepEqual(second.getQueryData(['currentUser']), { id: 'ordinary-bob-fixture' });
});
test('actual SSR root client retains the Source default query policy without fetching', async () => {
 let client!: QueryClient;
 await render(Root, { props: { children: () => { client = getClient(); } } });
 assert.deepEqual(client.getDefaultOptions(), { queries: { staleTime: 60_000, retry: 1 } });
 assert.equal(client.getQueryCache().getAll().length, 0);
});
