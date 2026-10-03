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
