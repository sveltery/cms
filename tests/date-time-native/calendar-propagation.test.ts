import { afterEach, expect, it } from 'vitest';
import { mount, unmount, flushSync, tick } from 'svelte';
import Harness from '../helpers/date-time/NativeHarness.svelte';
import { bridgeState } from '../helpers/date-time/state.svelte';
let component: ReturnType<typeof mount> | undefined, target: HTMLElement | undefined;
afterEach(async () => { if (component) await unmount(component); target?.remove(); });
it('contains recognized calendar keys while preserving unrelated key propagation', async () => {
  target = document.createElement('div'); document.body.append(target);
  const received: string[] = [];
  target.addEventListener('keydown', event => received.push(event.key));
  flushSync(() => { component = mount(Harness, { target: target!, props: { state: bridgeState({ date: new Date(2035, 5, 15, 12), time: '09:00', dateAriaLabel: 'Publication date' }) } }); });
  const button = [...target.querySelectorAll<HTMLButtonElement>('td button')].find(button => button.textContent === '15')!;
  button.focus();
  flushSync(() => button.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })));
  await tick();
  expect(received).toEqual([]);
  flushSync(() => button.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', bubbles: true, cancelable: true })));
  expect(received).toEqual(['x']);
});
