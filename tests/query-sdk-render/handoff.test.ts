import { render } from 'svelte/server';
import { afterEach, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import type { RequestEvent } from '@sveltejs/kit';
import { openSqlite } from '../../src/lib/server/database/sqlite.ts';
import { migrateCms } from '../../src/lib/server/database/migrations.ts';
import { withQueryRenderRequest } from '../../src/lib/server/query-sdk/render-context.ts';
import { primeSeoPanel, peekSeoPanel } from '../../src/lib/server/query-sdk/seo-panel.ts';
import { runWithContext, getRequestContext } from '../../src/lib/server/menus/context.ts';
import type { CmsDatabase } from '../../src/lib/server/database/contract.ts';
import SeoHandoffConsumer from '../helpers/query-sdk/SeoHandoffConsumer.svelte';

const databases: CmsDatabase[] = [];
async function database() {
  const value = openSqlite(':memory:'); await migrateCms(value); databases.push(value); return value;
}
afterEach(async () => {await Promise.all(databases.splice(0).map(value => value.close()));});
function event(database: CmsDatabase): Pick<RequestEvent, 'locals'> {
  return {locals: {cms: {database, principal: null, mutationsEnabled: false}}};
}
function panel(title: string) {return {title, description: null, image: null, canonical: null, noIndex: false};}

it('the actual async Svelte renderer consumes primed panel data in the public render boundary', async () => {
  const value = await database();
  const original = {editMode: false, locale: 'fr'};
  await runWithContext(original, async () => {
    const output = await withQueryRenderRequest(event(value), async () => {
      primeSeoPanel('post', 'entry-id', panel('SEO <bound> & visible'));
      await Promise.resolve();
      return await render(SeoHandoffConsumer, {props: {collection: 'post', id: 'entry-id'}});
    });
    expect(new JSDOM(output.body).window.document.querySelector('p')?.textContent).toBe('SEO <bound> & visible');
    expect(output.body).toContain('data-db-bound="true"');
    expect(output.body).toContain('data-locale="fr"');
    expect(getRequestContext()).toBe(original);
    expect(await peekSeoPanel('post', 'entry-id')).toBeNull();
  });
});

it('restores the original context when an actual async Svelte render fails', async () => {
  const value = await database();
  const original = {editMode: false};
  await runWithContext(original, async () => {
    await expect(withQueryRenderRequest(event(value), async () => {
      primeSeoPanel('post', 'entry-id', panel('Failed render panel'));
      return await render(SeoHandoffConsumer, {props: {collection: 'post', id: 'entry-id', fail: true}});
    })).rejects.toThrow('controlled component failure');
    expect(getRequestContext()).toBe(original);
    expect(await peekSeoPanel('post', 'entry-id')).toBeNull();
  });
});

it('keeps identical panel keys separate across configured database render scopes', async () => {
  const first = await database();
  const second = await database();
  const firstOutput = await withQueryRenderRequest(event(first), async () => {
    primeSeoPanel('post', 'entry-id', panel('First database'));
    return await render(SeoHandoffConsumer, {props: {collection: 'post', id: 'entry-id'}});
  });
  const secondOutput = await withQueryRenderRequest(event(second), async () => {
    primeSeoPanel('post', 'entry-id', panel('Second database'));
    return await render(SeoHandoffConsumer, {props: {collection: 'post', id: 'entry-id'}});
  });
  expect(firstOutput.body).toContain('First database');
  expect(firstOutput.body).not.toContain('Second database');
  expect(secondOutput.body).toContain('Second database');
  expect(secondOutput.body).not.toContain('First database');
  expect(getRequestContext()).toBeUndefined();
});
