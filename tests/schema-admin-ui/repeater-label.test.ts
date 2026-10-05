import { afterEach, expect, it, vi } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import FieldEditor from '../../src/lib/schema-admin/FieldEditor.svelte';

// Supplemental Native interaction coverage for the pinned FieldEditor.tsx:1208–1219
// label handler. Original Source callbacks and the prior Native30 stay unchanged.
const mounted: ReturnType<typeof mount>[] = [];
afterEach(async () => {
  for (const instance of mounted.splice(0)) await unmount(instance);
  document.body.replaceChildren();
});

async function editor(subFields: { slug: string; label: string; type: string }[] = []) {
  const target = document.createElement('section');
  document.body.append(target);
  const onSave = vi.fn();
  mounted.push(mount(FieldEditor, {
    target,
    props: {
      open: true,
      onOpenChange: () => {},
      onSave,
      field: { slug: 'items', label: 'Items', type: 'repeater', validation: { subFields } }
    }
  }));
  await tick();
  return { target, onSave };
}

function input(target: HTMLElement, label: string) {
  return [...target.querySelectorAll<HTMLLabelElement>('label')]
    .find(element => element.textContent === label)!.querySelector('input')!;
}

async function type(input: HTMLInputElement, value: string) {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await tick();
}

function button(target: HTMLElement, label: string) {
  return [...target.querySelectorAll<HTMLButtonElement>('button')]
    .find(element => element.textContent === label)!;
}

it('saves a newly added repeater sub-field from its label without requiring a manual slug', async () => {
  const { target, onSave } = await editor();
  button(target, 'Add sub-field').click();
  await tick();
  await type(input(target, 'Sub-field label'), '  Profile photo!  ');
  button(target, 'Update Field').click();
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
    validation: { subFields: [{ slug: 'profile_photo', label: '  Profile photo!  ', type: 'string', required: undefined }] }
  }));
  expect(input(target, 'Sub-field slug').value).toBe('profile_photo');
});

it('derives the repeater slug again when an existing label changes, including after a manual slug edit', async () => {
  const original = [{ slug: 'old_slug', label: 'Old label', type: 'string' }];
  const { target, onSave } = await editor(original);
  await type(input(target, 'Sub-field slug'), 'manual_slug');
  await type(input(target, 'Sub-field label'), ' Next -- caption 2! ');
  button(target, 'Update Field').click();
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
    validation: { subFields: [{ slug: 'next_caption_2', label: ' Next -- caption 2! ', type: 'string', required: undefined }] }
  }));
  expect(input(target, 'Sub-field slug').value).toBe('next_caption_2');
  expect(original).toEqual([{ slug: 'old_slug', label: 'Old label', type: 'string' }]);
});

it('retains a manually edited repeater slug when the label is unchanged', async () => {
  const { target, onSave } = await editor([{ slug: 'old_slug', label: 'Old label', type: 'string' }]);
  await type(input(target, 'Sub-field slug'), 'manual_slug');
  button(target, 'Update Field').click();
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
    validation: { subFields: [{ slug: 'manual_slug', label: 'Old label', type: 'string', required: undefined }] }
  }));
});
