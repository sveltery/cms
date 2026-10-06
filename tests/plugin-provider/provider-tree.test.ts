import { afterEach, expect, it, vi } from 'vitest';
import { flushSync, mount, tick, unmount } from 'svelte';
import ProviderTree from './fixtures/ProviderTree.svelte';
import BoundaryTree from './fixtures/BoundaryTree.svelte';
const instances: ReturnType<typeof mount>[] = [];
afterEach(async () => { for (const instance of instances.splice(0)) await unmount(instance); document.body.replaceChildren(); vi.restoreAllMocks(); });
function render<C extends typeof ProviderTree | typeof BoundaryTree>(component: C) {
  const target = document.createElement('div'); document.body.append(target);
  const instance = flushSync(() => mount(component, { target })); instances.push(instance);
  return { target, instance };
}
it('dispatches native widget/page components from the current isolated provider tree', async () => {
  const { target, instance } = render(ProviderTree); await tick();
  expect(target.querySelector('[data-outer]')?.textContent).toBe('First widgetFirst widget');
  (instance as ReturnType<typeof ProviderTree>).replaceAdmins(); await tick();
  expect(target.querySelector('[data-outer]')?.textContent).toBe('Second widgetSecond widget');
  expect(target.querySelector('[data-inner]')?.textContent).toBe('First widget');
});
it('contains panel rendering errors and retries after recovery without unmounting the host', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const { target, instance } = render(BoundaryTree); await tick();
  expect(target.textContent).toContain('Host stays mounted');
  expect(target.querySelector('[data-panel] [role=alert]')?.textContent).toContain('Plugin panel unavailable.');
  (instance as ReturnType<typeof BoundaryTree>).recover(); await tick();
  target.querySelector<HTMLButtonElement>('[data-panel] button')!.click(); await tick();
  expect(target.querySelector('[data-panel]')?.textContent).toBe('Recovered plugin');
});
it('contains failed cells and retries when the actual row reset key changes', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const { target, instance } = render(BoundaryTree); await tick();
  expect(target.querySelector('[data-column]')?.textContent).toContain('Plugin column unavailable');
  (instance as ReturnType<typeof BoundaryTree>).nextRow(); await tick(); await tick();
  expect(target.querySelector('[data-column]')?.textContent).toBe('Recovered plugin');
});
