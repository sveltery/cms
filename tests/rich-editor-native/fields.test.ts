// Supplemental ordinary Svelte DOM contracts; no credential, protected HTTP,
// principal, timing-race or persistence fixture is introduced here.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount, tick, unmount, type Component } from 'svelte';
const modulePath = '../../src/lib/editor/fields/FieldHost.svelte';
const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0)) await cleanup(); });
interface Field { id: string; type: string; kind: string; label: string; required: boolean;
  translatable: boolean; options?: { value: string; label: string }[]; validation?: Record<string, unknown>; }
interface FieldProps { name: string; field: Field; value: unknown; onChange: (value: unknown) => void; readOnly?: boolean; timezone?: string; }
async function render(type: string, value: unknown, extra: Partial<Field> = {}, readOnly = false) {
  const result = await import(modulePath).then(module => ({ ready: true, module }),
    () => ({ ready: false, module: undefined }));
  expect(result.ready).toBe(true);
  const host = document.createElement('div'); document.body.append(host);
  const onChange = vi.fn();
  const instance = mount(result.module!.default as Component<FieldProps>, { target: host, props: {
    name: 'value', field: { id: 'value', type, kind: type === 'integer' ? 'number' : type,
      label: 'Value', required: false, translatable: true, ...extra }, value, onChange, readOnly, timezone: 'UTC'
  } });
  cleanups.push(async () => { await unmount(instance); host.remove(); }); await tick();
  return { host, onChange };
}
async function input(element: HTMLInputElement | HTMLTextAreaElement, value: string, event = 'input') {
  element.value = value; element.dispatchEvent(new Event(event, { bubbles: true })); await tick();
}
describe('Native typed content fields', () => {
  it('emits real numeric values and preserves the Source empty-number coercion to zero', async () => {
    const { host, onChange } = await render('number', 12.5, { validation: { min: 0, max: 100 } });
    const control = host.querySelector<HTMLInputElement>('input[type="number"]')!;
    expect(control.value).toBe('12.5'); await input(control, '3.75'); expect(onChange).toHaveBeenLastCalledWith(3.75);
    await input(control, ''); expect(onChange).toHaveBeenLastCalledWith(0);
  });
  it('emits a boolean from a real checked control', async () => {
    const { host, onChange } = await render('boolean', false);
    const control = host.querySelector<HTMLInputElement>('input[type="checkbox"], [role="switch"]')!;
    control.click(); await tick(); expect(onChange).toHaveBeenLastCalledWith(true);
  });
  it('emits selected option values and keeps their visible labels', async () => {
    const { host, onChange } = await render('select', 'ct', { options: [{ value: 'ct', label: 'CT' }, { value: 'mri', label: 'MRI' }] });
    const control = host.querySelector<HTMLSelectElement>('select')!;
    expect(control.value).toBe('ct'); expect(control.textContent).toContain('MRI');
    control.value = 'mri'; control.dispatchEvent(new Event('change', { bubbles: true })); await tick();
    expect(onChange).toHaveBeenLastCalledWith('mri');
  });
  it('emits an ordered multi-select list without deleting existing selections', async () => {
    const { host, onChange } = await render('multiSelect', ['ct'], { options: [{ value: 'ct', label: 'CT' }, { value: 'mri', label: 'MRI' }] });
    const controls = host.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    expect(controls[0].checked).toBe(true); controls[1].click(); await tick();
    expect(onChange).toHaveBeenLastCalledWith(['ct', 'mri']);
  });
  it('retains invalid JSON locally and emits typed JSON only after successful blur parsing', async () => {
    const { host, onChange } = await render('json', { previous: true });
    const control = host.querySelector<HTMLTextAreaElement>('textarea')!;
    await input(control, '{invalid'); control.dispatchEvent(new Event('blur')); await tick();
    expect(onChange).not.toHaveBeenCalled(); expect(host.textContent).toContain('Invalid JSON');
    await input(control, '{"next":42}'); control.dispatchEvent(new Event('blur')); await tick();
    expect(onChange).toHaveBeenLastCalledWith({ next: 42 });
    await input(control, '  '); control.dispatchEvent(new Event('blur')); await tick();
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
  it('trims URL values on blur and reports invalid values without changing their data', async () => {
    const { host, onChange } = await render('url', '');
    const control = host.querySelector<HTMLInputElement>('input')!;
    await input(control, '  https://example.com/path  '); control.dispatchEvent(new Event('blur')); await tick();
    expect(onChange).toHaveBeenLastCalledWith('https://example.com/path');
    await input(control, 'not a url'); control.dispatchEvent(new Event('blur')); await tick();
    expect(onChange).toHaveBeenLastCalledWith('not a url'); expect(host.textContent).toContain('Enter a valid URL');
  });
  it('reuses the real landed datetime control with full ISO storage values', async () => {
    const { host, onChange } = await render('datetime', '2026-02-26T09:30:00.000Z');
    const control = host.querySelector<HTMLInputElement>('input[type="datetime-local"]')!;
    expect(control.value).toBe('2026-02-26T09:30'); await input(control, '2026-02-27T10:15');
    expect(onChange).toHaveBeenLastCalledWith('2026-02-27T10:15:00.000Z');
  });
  it('keeps a malformed list value unchanged until an explicit replacement', async () => {
    const original = { legacy: 'Retain this' };
    const { host, onChange } = await render('repeater', original, { validation: { subFields: [{ slug: 'caption', type: 'string', label: 'Caption' }] } });
    expect(onChange).not.toHaveBeenCalled(); expect(host.textContent).toContain('stored value');
    const button = [...host.querySelectorAll<HTMLButtonElement>('button')].find(element => element.textContent?.includes('Replace with empty list'))!;
    button.click(); await tick(); expect(onChange).toHaveBeenLastCalledWith([]); expect(original).toEqual({ legacy: 'Retain this' });
  });
  it('disables value edits for the existing read-only editor contract', async () => {
    const { host, onChange } = await render('number', 12, {}, true);
    const control = host.querySelector<HTMLInputElement>('input')!;
    expect(control.disabled).toBe(true); expect(control.value).toBe('12'); expect(onChange).not.toHaveBeenCalled();
  });
});
