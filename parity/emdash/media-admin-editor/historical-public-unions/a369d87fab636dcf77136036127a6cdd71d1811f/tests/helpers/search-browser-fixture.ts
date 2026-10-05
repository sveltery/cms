import { test as base, expect, type Page } from '@playwright/test';
import { schemaAdminRemotes } from './schema-admin-remotes.ts';
import { ContentRepository } from '../../src/lib/server/database/lifecycle/upstream/database/repositories/content.ts';
import { registerLifecycleDatabase } from '../../src/lib/server/database/lifecycle/upstream/host.ts';
export { expect };
export type SearchFixture = Awaited<ReturnType<typeof schemaAdminRemotes>>;
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
        await h.registry.createCollection({ slug: collection, label: collection });
        await h.registry.createField(collection, { slug:'title',label:'Title',type:'string' });
      }
      for (const [collection,title,status] of [
        ['posts','First Post','published'],['posts','Second Post','published'],
        ['posts','Draft Post','draft'],['posts','Post With Image','published'],
        ['pages','About','published'],['pages','Contact','draft']
      ]) await repo.create({type:collection,slug:title.toLowerCase().replaceAll(' ','-'),status,data:{title}});
      await use(h);
    } finally { await h.close(); }
  },
  admin: async ({ searchFixture:h, context, page }, use) => {
    await use({
      async devBypassAuth() { await context.addCookies([{name:'cms-session',value:h.tokens.admin,url:h.origin}]); },
      async goToDashboard() { await page.goto(h.origin); }
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
