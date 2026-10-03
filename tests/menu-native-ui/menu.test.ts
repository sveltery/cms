import { afterEach, expect, it, vi } from 'vitest';
import { flushSync, mount, tick, unmount } from 'svelte';
import MenuList from '../../src/lib/menus/MenuList.svelte';
import MenuEditor from '../../src/lib/menus/MenuEditor.svelte';
import type { MenuClient, Menu, MenuItem } from '../../src/lib/menus/types.ts';

// Original native DOM checks; whole Source browser evidence is separate.
const mounted: ReturnType<typeof mount>[] = [];
afterEach(async () => { for (const instance of mounted.splice(0)) await unmount(instance); document.body.replaceChildren(); });
const item = (id: string, label: string, parentId: string | null = null): MenuItem => ({ id, label, parentId, menuId: 'main', sortOrder: Number(id), type: 'custom', customUrl: '/', referenceCollection: null, referenceId: null, titleAttr: null, target: null, cssClasses: null, createdAt: '', locale: 'en', translationGroup: id });
const menu: Menu = { id: 'main', name: 'main', label: 'Main Menu', createdAt: '', updatedAt: '', locale: 'en', translationGroup: 'main' };
function client() {
  return { fetchMenus: vi.fn(async () => [{ ...menu, itemCount: 3 }]), fetchMenu: vi.fn(async () => ({ ...menu, items: [item('1', 'Home'), item('2', 'About'), item('3', 'Services', '1')] })),
    createMenu: vi.fn(async () => menu), updateMenu: vi.fn(async () => menu), deleteMenu: vi.fn(async () => {}), createMenuItem: vi.fn(async () => item('4', 'New')),
    updateMenuItem: vi.fn(async () => item('1', 'Edited')), deleteMenuItem: vi.fn(async () => {}), reorderMenuItems: vi.fn(async () => []),
    fetchMenuTranslations: vi.fn(async () => ({ translationGroup: 'main', translations: [menu] })), createMenuTranslation: vi.fn(async () => ({ ...menu, locale: 'fr' })) } satisfies MenuClient;
}
async function render(component: typeof MenuList | typeof MenuEditor, props: object) {
  const target = document.createElement('div'); document.body.append(target);
  mounted.push(flushSync(() => mount(component as typeof MenuList, { target, props })));
  await tick(); await Promise.resolve(); await tick();
  return target;
}
const click = async (target: HTMLElement, label: string) => { const button = [...target.querySelectorAll<HTMLButtonElement>('button')].find(node => node.textContent?.trim() === label || node.getAttribute('aria-label') === label); expect(button).toBeDefined(); button!.click(); await tick(); };

it('native list renders persisted menu counts and edit destinations', async () => {
  const target = await render(MenuList, { client: client() });
  expect(target.textContent).toContain('Main Menu'); expect(target.textContent).toContain('3 items');
  expect(target.querySelector('a')?.getAttribute('href')).toBe('/menus/main?locale=en');
});
it('native create dialog preserves a pending write through close and reopen', async () => {
  const api = client(); let finish!: (value: Menu) => void;
  api.createMenu.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const target = await render(MenuList, { client: api, navigate: vi.fn() }); await click(target, 'Create Menu');
  const form = target.querySelector('form')!; (form.elements.namedItem('name') as HTMLInputElement).value = 'slow'; (form.elements.namedItem('label') as HTMLInputElement).value = 'Slow';
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await tick();
  await click(target, 'Cancel'); await click(target, 'Create Menu');
  expect(target.querySelector<HTMLButtonElement>('button[type=submit]')?.disabled).toBe(true); expect(api.createMenu).toHaveBeenCalledTimes(1);
  finish(menu); await Promise.resolve(); await tick(); expect(target.querySelector('dialog')).toBeNull();
});
it('native editor indents children and constrains reorder controls to siblings', async () => {
  const target = await render(MenuEditor, { client: client(), name: 'main' });
  const row = [...target.querySelectorAll<HTMLDivElement>('div.border')].find(node => node.textContent?.includes('Services'))!;
  expect(row.style.marginInlineStart).toBe('1.5rem');
  expect(row.querySelector<HTMLButtonElement>('[aria-label="Move up"]')?.disabled).toBe(true);
  expect(row.querySelector<HTMLButtonElement>('[aria-label="Move down"]')?.disabled).toBe(true);
});
it('native editor excludes itself and descendants from parent choices', async () => {
  const target = await render(MenuEditor, { client: client(), name: 'main' }); await click(target, 'Edit'); await click(target, 'Parent');
  const options = [...target.querySelectorAll('[role=option]')].map(node => node.textContent);
  expect(options).toContain('About'); expect(options).not.toContain('Home'); expect(options).not.toContain('Services');
});
it('native item deletion calls the backend immediately without confirmation', async () => {
  const api = client(); const target = await render(MenuEditor, { client: api, name: 'main' }); await click(target, 'Delete');
  expect(api.deleteMenuItem).toHaveBeenCalledWith('main', '1', { locale: 'en' }); expect(target.querySelector('dialog')).toBeNull();
});
