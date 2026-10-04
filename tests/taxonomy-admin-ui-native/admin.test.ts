// Native ordinary DOM/client requirements. These are supplemental and earn
// no Source parity credit. Missing product imports reject inside expectations.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { flushSync, mount, unmount } from 'svelte';
import { within } from '@testing-library/react';

const mounted: ReturnType<typeof mount>[] = [];
const clients: QueryClient[] = [];
afterEach(async () => {
  for (const instance of mounted.splice(0)) await unmount(instance);
  for (const client of clients.splice(0)) client.clear();
  document.body.replaceChildren();
});

async function product(name: string) {
  const specifier = '../../src/lib/taxonomies/' + name;
  let module: any;
  await expect((async () => { module = await import(specifier); })()).resolves.toBeUndefined();
  return module;
}

const definition = { id: 'categories', name: 'categories', label: 'Categories', labelSingular: 'Category', hierarchical: true, collections: ['posts'], locale: 'en', translationGroup: 'categories' };
const term = { id: 'tech', name: 'tech', slug: 'tech', label: 'Technology', parentId: null, children: [], count: 5, locale: 'en', translationGroup: 'tech' };
function fixtureClient() {
  return {
    fetchManifest: async () => ({ collections: { posts: { label: 'Posts' } } }),
    fetchTaxonomyDefs: async () => [definition], fetchTaxonomyDef: async () => definition,
    fetchTerms: async () => [term]
  };
}
function render(Component: any, props: Record<string, unknown>) {
  const target = document.createElement('div'); document.body.append(target);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  clients.push(queryClient);
  mounted.push(flushSync(() => mount(Component, { target, props: { ...props, queryClient } })));
  return within(target);
}

describe('Native taxonomy administration', () => {
  it('shows the taxonomy label and real returned count through the mounted manager', async () => {
    const module = await product('TaxonomyManager.svelte');
    const screen = render(module.default, { taxonomyName: 'categories', client: fixtureClient() });
    await vi.waitFor(() => expect(screen.queryByRole('heading', { name: 'Categories' })).not.toBeNull());
    expect(screen.queryByText('Technology')).not.toBeNull();
    expect(screen.queryByText('5', { exact: true })).not.toBeNull();
  });
  it('opens the real editor picker and exposes its returned term', async () => {
    const module = await product('TaxonomySidebar.svelte');
    const screen = render(module.default, { collection: 'posts', canManageTaxonomies: true, client: fixtureClient() });
    const trigger = await vi.waitFor(() => screen.getByRole('button', { name: 'Choose Categories' }));
    flushSync(() => trigger.click());
    await vi.waitFor(() => expect(screen.queryByRole('checkbox', { name: 'Technology' })).not.toBeNull());
  });
  it('uses the Native API base and preserves locale and count-free request inputs', async () => {
    const module = await product('client.ts');
    const requests: string[] = [];
    const client = module.createTaxonomyClient({ fetch: async (url: string | URL | Request) => {
      requests.push(String(url));
      return new Response(JSON.stringify({ success: true, data: { terms: [term] } }), { headers: { 'Content-Type': 'application/json' } });
    } });
    const terms = await client.fetchTerms('categories', { locale: 'ja', includeCounts: false });
    expect(requests).toEqual(['/api/taxonomies/categories/terms?locale=ja&includeCounts=false']);
    expect(terms).toEqual([term]);
  });
  it('keeps an untranslated-parent row in place while permuting its real siblings', async () => {
    const module = await product('tree.ts');
    const a = { ...term, id: 'a', label: 'Alpha' };
    const orphan = { ...term, id: 'orphan', label: 'Orphan', parentId: 'untranslated-parent' };
    const b = { ...term, id: 'b', label: 'Beta' };
    const next = module.reorderWithinSlots([a, orphan, b], [a, b], [b, a]);
    expect(next.map((row: typeof term) => row.id)).toEqual(['b', 'orphan', 'a']);
    expect(next[1]).toBe(orphan);
  });
});
