import { afterEach, expect, it, vi } from 'vitest';
import { mount, flushSync, tick, unmount } from 'svelte';
import MenuEditor from '../../src/lib/menus/MenuEditor.svelte';
import type { MenuClient } from '../../src/lib/menus/types.ts';
const instances: ReturnType<typeof mount>[] = [];
afterEach(async () => { for (const instance of instances.splice(0)) await unmount(instance); document.body.replaceChildren(); });
const menu = { id: 'menu-fr', name: 'main', label: 'Main', createdAt: '', updatedAt: '', locale: 'fr', translationGroup: 'menu-group' };
function fixture() {
  const client = { fetchMenu: vi.fn(async () => ({ ...menu, items: [] })), createMenuItem: vi.fn(async () => ({})) } as unknown as MenuClient;
  const english = { id: 'post-en', type: 'posts', collection: 'posts', title: 'English entry', data: { title: 'English entry' }, slug: 'english', locale: 'en', translationGroup: 'group', liveRevisionId: 'live', draftRevisionId: 'live' };
  const french = { ...english, id: 'post-fr', title: 'French entry', data: { title: 'French entry' }, locale: 'fr' };
  const contentClient = { collections: async () => [{ slug: 'posts', label: 'Posts' }, { slug: 'people', label: 'People' }],
    entries: async (_collection: string, locale?: string) => locale === 'fr' ? [french] : [english, french],
    fetchCollections: async () => [{ slug: 'posts', label: 'Posts' }, { slug: 'people', label: 'People' }], fetchManifest: async () => ({ collections: { posts: { titleField: 'title' } } }),
    fetchContentList: vi.fn(async () => ({ items: [english, french], nextCursor: 'page-2' })) };
  return { client, contentClient };
}
async function render() {
  const target = document.createElement('div'); document.body.append(target); const fixtureData = fixture();
  instances.push(flushSync(() => mount(MenuEditor, { target, props: { ...fixtureData, name: 'main', locale: 'fr' } })));
  await tick(); await Promise.resolve(); await tick();
  [...target.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === 'Add Content')!.click();
  await tick(); await Promise.resolve(); await tick(); await Promise.resolve(); await tick(); return { target, ...fixtureData };
}
it('menu picker exposes Source search instead of a fixed first page', async () => {
  const { target } = await render();
  expect(!!target.querySelector('input[placeholder="Search content..."]')).toBe(true);
});
it('menu picker exposes all persisted locales even for a French menu', async () => {
  const { target } = await render();
  expect(target.textContent?.includes('English entry')).toBe(true);
  expect(target.textContent?.includes('French entry')).toBe(true);
});
it('menu picker exposes cursor continuation for deeper content', async () => {
  const { target } = await render();
  expect([...target.querySelectorAll('button')].some(button => button.textContent?.trim() === 'Load more')).toBe(true);
});
