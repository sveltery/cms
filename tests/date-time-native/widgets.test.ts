import { expect, it, afterEach } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import ScalarHarness from '../helpers/date-time/ScalarHarness.svelte';
import { bridgeState } from '../helpers/date-time/state.svelte';
const components: ReturnType<typeof mount>[] = [];
const containers: HTMLElement[] = [];
afterEach(async () => { for (const component of components.splice(0)) await unmount(component); for (const container of containers.splice(0)) container.remove(); });
const input = () => document.querySelector('input[data-field="starts_at"]') as HTMLInputElement | null;
it('renders the stored UTC instant in the configured site timezone', () => {
  const target = document.createElement('div'); document.body.append(target); containers.push(target);
  flushSync(() => components.push(mount(ScalarHarness, { target, props: { state: bridgeState({ id: 'starts_at', label: 'Starts', value: '2026-02-26T09:30:00.000Z', timezone: 'Asia/Tokyo' }) } })));
  expect(input()?.value).toBe('2026-02-26T18:30');
});
it('provides a datetime-local editor with the field label', () => {
  const target = document.createElement('div'); document.body.append(target); containers.push(target);
  flushSync(() => components.push(mount(ScalarHarness, { target, props: { state: bridgeState({ id: 'starts_at', label: 'Starts', value: '', timezone: 'UTC' }) } })));
  expect(input()?.type).toBe('datetime-local');
  expect(document.querySelector('label')?.textContent).toContain('Starts');
});
it.each([
  ['2026-02-26T18:30', 'Asia/Tokyo', '2026-02-26T09:30:00.000Z'],
  ['', 'UTC', ''],
  ['2026-11-01T01:30', 'America/New_York', '2026-11-01T01:30'],
  ['2026-03-08T02:30', 'America/New_York', '2026-03-08T02:30']
])('emits the pinned datetime field value for %s in %s', (edited, timezone, expected) => {
  const values: string[] = [], target = document.createElement('div'); document.body.append(target); containers.push(target);
  flushSync(() => components.push(mount(ScalarHarness, { target, props: { state: bridgeState({ id: 'starts_at', label: 'Starts', value: '', timezone, onChange: (value: string) => values.push(value) }) } })));
  flushSync(() => { input()!.value = edited; input()!.dispatchEvent(new Event('input', { bubbles: true })); });
  expect(values).toEqual([expected]);
});
