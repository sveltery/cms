// Supplemental Native caller reactivity; first execution earns no causal Source credit.
import { afterEach, expect, it } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import Harness from '../helpers/date-time/NativeHarness.svelte';
import { bridgeState } from '../helpers/date-time/state.svelte.ts';
import { getDayPickerLocale as sourceLocale } from '../../parity/emdash/calendar-shared-picker-labels/source/packages/admin/src/locales/day-picker.ts';
const targets: HTMLElement[] = [], mounted: ReturnType<typeof mount>[] = [];
afterEach(async () => { for (const component of mounted.splice(0)) await unmount(component); for (const target of targets.splice(0)) target.remove(); });
function field() {
  const target = document.createElement('div'); document.body.append(target); targets.push(target);
  const state = bridgeState({ date: new Date(2035, 5, 15, 12), time: '09:05', locale: 'en', dateAriaLabel: 'Publication date', translate: (message: string) => `FIRST ${message}` });
  flushSync(() => mounted.push(mount(Harness, { target, props: { state } })));
  return { target, state };
}
it('renders replacement caller translator without a shared subscription', () => {
  const { target, state } = field();
  expect(target.querySelector('legend')?.textContent).toBe('FIRST Time');
  flushSync(() => { state.translate = (message: string) => `SECOND ${message}`; });
  expect(target.querySelector('legend')?.textContent).toBe('SECOND Time');
  expect(target.querySelector('input')?.getAttribute('aria-label')).toBe('SECOND Hour');
});
it('updates actual vendor labels when the supplied locale changes', () => {
  const { target, state } = field();
  expect(target.querySelector('.calendar-nav button')?.getAttribute('aria-label')).toBe(String(sourceLocale('en').labels!.labelPrevious));
  flushSync(() => { state.locale = 'fr'; });
  expect(target.querySelector('.calendar-nav button')?.getAttribute('aria-label')).toBe(String(sourceLocale('fr').labels!.labelPrevious));
  expect(target.querySelector('input')?.value).toBe('09');
});
