import { expect, it } from 'vitest';
import { EditorResponseError, describeContentValidationError } from '../../src/lib/editor/errors';
import { mount, unmount, tick } from 'svelte';
import WritableDraft from '../../src/lib/editor/WritableDraft.svelte';

// Original fidelity cases for scalar details in the complete pinned authorities.
it('the pinned label fallback also applies to an inherited constructor name', () => {
  const error = new EditorResponseError(400, 'VALIDATION_ERROR', 'raw', { issues: [{ path: 'constructor', code: 'unknown_field' }] });
  expect(describeContentValidationError(error, {})).toBe('Constructor is not a field in this collection.');
});
it('a scalar without declared bounds has no invented maxlength', async () => {
  const target = document.createElement('div'); document.body.append(target);
  const instance = mount(WritableDraft, { target, props: {
    fields: [{ id: 'title', slug: 'title', label: 'Title', type: 'string', required: false, validation: null }], canWrite: true
  } });
  try { await tick(); expect(target.querySelector('input[data-field=title]')?.hasAttribute('maxlength')).toBe(false); }
  finally { await unmount(instance); target.remove(); }
});

it('non-string scalar values remain in the payload and display as empty without coercion', async () => {
  const target = document.createElement('form'); document.body.append(target);
  const values = { title: 42, summary: { legacy: true } };
  const instance = mount(WritableDraft, { target, props: { canWrite: true, values, fields: [
    { id: 'title', slug: 'title', label: 'Title', type: 'string', required: false, validation: null },
    { id: 'summary', slug: 'summary', label: 'Summary', type: 'text', required: false, validation: null }
  ] } });
  try {
    await tick();
    expect((target.querySelector('[data-field=title]') as HTMLInputElement).value).toBe('');
    expect((target.querySelector('[data-field=summary]') as HTMLTextAreaElement).value).toBe('');
    expect(JSON.parse(String(new FormData(target).get('data')))).toEqual(values);
  } finally { await unmount(instance); target.remove(); }
});

it('declared minimum length gives an accessible hint without adding native submission blocking', async () => {
  const target = document.createElement('div'); document.body.append(target);
  const instance = mount(WritableDraft, { target, props: { canWrite: true, values: { title: 'abc' }, fields: [
    { id: 'title', slug: 'title', label: 'Title', type: 'string', required: false, validation: { minLength: 5, maxLength: 10 } }
  ] } });
  try {
    await tick(); const input = target.querySelector('[data-field=title]') as HTMLInputElement;
    expect(input.hasAttribute('minlength')).toBe(false);
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(target.querySelector(`#${input.getAttribute('aria-describedby')}`)?.textContent).toBe('3 of 10 characters, at least 5');
    expect(input.getAttribute('dir')).toBe('auto');
  } finally { await unmount(instance); target.remove(); }
});

it('markdown text follows the pinned textarea defaults and leaves required validation to the service', async () => {
  const target = document.createElement('div'); document.body.append(target);
  const instance = mount(WritableDraft, { target, props: { canWrite: true, fields: [
    { id: 'summary', slug: 'summary', label: 'Summary', type: 'text', required: true, validation: null }
  ] } });
  try {
    await tick(); const input = target.querySelector('[data-field=summary]') as HTMLTextAreaElement;
    expect(input.required).toBe(false);
    expect(input.rows).toBe(10);
    expect(input.placeholder).toBe('Enter markdown content...');
    expect(input.getAttribute('dir')).toBe('auto');
  } finally { await unmount(instance); target.remove(); }
});
