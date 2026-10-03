import { afterEach, expect, it } from 'vitest';
import { mount, unmount, flushSync, tick } from 'svelte';
import Harness from '../helpers/date-time/NativeHarness.svelte';
import { bridgeState } from '../helpers/date-time/state.svelte';
const mounted: ReturnType<typeof mount>[] = [];
const containers: HTMLElement[] = [];
afterEach(async () => { for (const component of mounted.splice(0)) await unmount(component); for (const container of containers.splice(0)) container.remove(); });
function calendar() {
  const target = document.createElement('div'); document.body.append(target); containers.push(target);
  flushSync(() => mounted.push(mount(Harness, { target, props: { state: bridgeState({ date: new Date(2035, 5, 15, 12), time: '09:00', dateAriaLabel: 'Publication date' }) } })));
  return [...document.querySelectorAll<HTMLButtonElement>('td button')].find(button => button.textContent === '15')!;
}
it.each([
  ['ArrowRight', new Date(2035, 6, 15)],
  ['ArrowDown', new Date(2036, 5, 15)]
])('retains DayPicker shifted %s navigation', async (key, expected) => {
  const button = calendar(); button.focus();
  flushSync(() => button.dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey: true, bubbles: true })));
  await tick();
  expect(document.activeElement?.id.endsWith(`-${expected.getFullYear()}-${expected.getMonth()}-${expected.getDate()}`)).toBe(true);
});
