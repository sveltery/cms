import { afterEach, expect, it } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import Harness from '../helpers/date-time/NativeHarness.svelte';
import { bridgeState } from '../helpers/date-time/state.svelte';
let component: ReturnType<typeof mount> | undefined, parent: HTMLElement | undefined;
afterEach(async () => { if (component) await unmount(component); parent?.remove(); });
it('contains a selected-day click while preserving optional date selection', () => {
  parent = document.createElement('div');
  const target = document.createElement('div'); parent.append(target); document.body.append(parent);
  let received = 0;
  const selections: Array<Date | undefined> = [];
  parent.addEventListener('click', () => { received++; });
  flushSync(() => { component = mount(Harness, { target, props: { state: bridgeState({
    date: new Date(2035, 5, 15, 12), time: '09:00', dateAriaLabel: 'Publication date',
    onDateChange: (date: Date | undefined) => selections.push(date)
  }) } }); });
  const button = [...target.querySelectorAll<HTMLButtonElement>('td button')].find(button => button.textContent === '15')!;
  const click = new MouseEvent('click', { bubbles: true, cancelable: true });
  flushSync(() => button.dispatchEvent(click));
  expect(selections).toEqual([undefined]);
  expect(received).toBe(0);
  expect(click.defaultPrevented).toBe(true);
});
