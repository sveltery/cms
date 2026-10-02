// Test-only native Kit transport adapter for unchanged pinned autosave bodies.
// Actual schema, content, publication, query and save operations are required.
// This maps Kit form/query URLs and encoded domain status, not production REST.
import { test as base, type Page, type Response as BrowserResponse } from '@playwright/test';
import { schemaAdminRemotes } from './schema-admin-remotes';

interface NativeAutosaveAdmin {
  page: Page; devBypassAuth(): Promise<void>; goToEditContent(collection: string, id: string): Promise<void>; waitForLoading(): Promise<void>;
}
type Harness = Awaited<ReturnType<typeof schemaAdminRemotes>>;
function nativePage(page: Page, h: Harness, key: { collection: string; id: string }) {
  async function response(value: BrowserResponse) {
    const save = value.url().includes(`/_app/remote/${h.ids.get('autosaveEditorContent')}`);
    const read = value.url().includes(`/_app/remote/${h.ids.get('getLifecycleContent')}`);
    if (!save && !read) return value;
    const envelope = save ? await value.json().catch(() => undefined) : undefined;
    return new Proxy(value, { get(target, name) {
      if (name === 'url') return () => `${h.origin}/_emdash/api/content/${key.collection}/${key.id}`;
      if (name === 'status') return () => envelope?.type === 'error' ? envelope.status : target.status();
      if (name === 'request') return () => new Proxy(target.request(), { get(request, field) {
        if (field === 'method') return () => save ? 'PUT' : 'GET';
        const value = Reflect.get(request, field); return typeof value === 'function' ? value.bind(request) : value;
      } });
      const value = Reflect.get(target, name); return typeof value === 'function' ? value.bind(target) : value;
    } });
  }
  return new Proxy(page, { get(target, name) {
    if (name === 'waitForResponse') return async (predicate: (value: BrowserResponse) => boolean, options?: { timeout?: number }) =>
      response(await target.waitForResponse(async value => predicate(await response(value)), options));
    if (name === 'on') return (event: string, listener: (value: any) => void) => {
      if (event === 'response') target.on('response', value => { void response(value).then(listener); });
      else target.on(event as any, listener);
      return target;
    };
    const value = Reflect.get(target, name); return typeof value === 'function' ? value.bind(target) : value;
  } });
}
export const test = base.extend<{ nativeAutosave: {
  collection: string; id: string; origin: string; token: string;
  fetch: typeof globalThis.fetch; admin: NativeAutosaveAdmin;
}; admin: NativeAutosaveAdmin }>({ nativeAutosave: async ({ page }, use) => {
  page.setDefaultTimeout(5_000);
    const h = await schemaAdminRemotes('Node');
  try {
    const collection = `autosave_${Date.now()}`;
    await h.registry.createCollection({ slug: collection, label: 'Autosave Test', labelSingular: 'Autosave Test', supports: ['revisions', 'drafts'] });
    await h.registry.createField(collection, { slug: 'title', type: 'string', label: 'Title', required: true });
    const created = (await h.mutate('createLifecycleContent', { collection, data: JSON.stringify({ title: 'Original' }), slug: 'autosave-test' }))._.result;
    await h.mutate('publishContent', { collection, id: created.id, _rev: created._rev });
    const key = { collection, id: created.id };
    const admin = {
      page: nativePage(page, h, key),
      async devBypassAuth() { await page.context().addCookies([{ name: 'cms-session', value: h.tokens.admin, url: h.origin }]); },
      async goToEditContent(collection: string, id: string) { await page.goto(`${h.origin}/content/${collection}/${id}`); },
      async waitForLoading() { await page.getByRole('navigation', { name: 'Workspace' }).waitFor(); }
    };
    const fetch: typeof globalThis.fetch = async (input, init) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input : input.url);
      if (url.pathname === `/_emdash/api/schema/collections/${collection}/fields` && init?.method === 'POST') {
        const field = await h.registry.createField(collection, JSON.parse(String(init.body)));
        return Response.json({ data: { item: field } }, { status: 201 });
      }
      if (url.pathname === `/_emdash/api/content/${collection}/${created.id}/revisions` && (!init?.method || init.method === 'GET')) {
        const items = await h.query('listContentRevisions', { collection, id: created.id });
        return Response.json({ data: { items, total: items.length } });
      }
      throw new Error(`Unadapted source request: ${init?.method ?? 'GET'} ${url.pathname}`);
    };
    await use({ collection, id: created.id, origin: h.origin, token: h.tokens.admin, fetch, admin });
  } finally { await h.close(); }
}, admin: async ({ nativeAutosave }, use) => { await use(nativeAutosave.admin); } });
export { expect } from '@playwright/test';
