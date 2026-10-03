import { test as base, expect, type Page } from '@playwright/test';
import { schemaAdminRemotes } from './schema-admin-remotes.ts';
import { ContentRepository } from '../../src/lib/server/database/lifecycle/upstream/database/repositories/content.ts';
import { registerLifecycleDatabase } from '../../src/lib/server/database/lifecycle/upstream/host.ts';
import {readFileSync} from 'node:fs';
import {setupSeedDependencies} from '../../src/lib/server/setup/seed-providers.ts';
export { expect };
export type SearchFixture = Awaited<ReturnType<typeof schemaAdminRemotes>>;
// Actual pinned fixture flags, rather than the search test's stale auto-seed
// comment. This projects only the collection/title closure needed by this
// search browser family; the retained original seed includes other providers.
const seed=JSON.parse(readFileSync(new URL('../../parity/emdash/search-source/e2e/fixture/.emdash/seed.json',import.meta.url),'utf8'));
export const test = base.extend<{
  searchFixture: SearchFixture;
  admin: { devBypassAuth(): Promise<void>; goToDashboard(): Promise<void> };
  serverInfo: { baseUrl: string; token: string };
}>({
  searchFixture: async ({}, use) => {
    const h = await schemaAdminRemotes('Node');
    try {
      registerLifecycleDatabase(h.database);
      const repo = new ContentRepository(h.database.db as unknown as ConstructorParameters<typeof ContentRepository>[0]);
      for (const collection of ['posts','pages']) {
        const definition=seed.collections.find((value:{slug:string})=>value.slug===collection);
        await h.registry.createCollection({ slug: collection, label: definition.label,supports:definition.supports });
        await h.registry.createField(collection, definition.fields.find((value:{slug:string})=>value.slug==='title'));
      }
      for (const [collection,title,status] of [
        ['posts','First Post','published'],['posts','Second Post','published'],
        ['posts','Draft Post','draft'],['posts','Post With Image','published'],
        ['pages','About','published'],['pages','Contact','draft']
      ]) await repo.create({type:collection,slug:title.toLowerCase().replaceAll(' ','-'),status,data:{title}});
      for(const collection of ['posts','pages'])await setupSeedDependencies.enableSearch!(h.database,collection);
      await use(h);
    } finally { await h.close(); }
  },
  admin: async ({ searchFixture:h, context, page }, use) => {
    await use({
      async devBypassAuth() { await context.addCookies([{name:'cms-session',value:h.tokens.admin,url:h.origin}]); },
      async goToDashboard() { await page.goto(h.origin);await page.locator('[data-cms-command-ready="true"]').waitFor({state:'attached'}); }
    });
  },
  serverInfo: async ({searchFixture:h},use) => {await use({baseUrl:h.origin,token:h.tokens.admin});}
});
/** Source REST URI and bearer test token become native URI and stored session cookie.
 * Requests still reach the real built Kit application; no response fabrication. */
export async function fetch(input: string | URL | Request, init: RequestInit = {}) {
  const request = new Request(input,init);
  const url = new URL(request.url);url.pathname=url.pathname.replace('/_emdash/api/','/api/');
  const headers=new Headers(request.headers);const authorization=headers.get('authorization');
  if(authorization?.startsWith('Bearer ')) { headers.set('cookie','cms-session='+authorization.slice(7));headers.delete('authorization'); }
  return globalThis.fetch(new Request(url,request),{headers});
}
