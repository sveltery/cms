// Test-only controlled DOM transport; no request or fabricated product result.
import { createAttachmentKey } from 'svelte/attachments';
import { create_field_proxy, deep_set } from '../../../node_modules/@sveltejs/kit/src/runtime/form-utils.js';

type Descriptor = {
  method: string;
  action: string;
  pending: number;
  result: undefined;
  fields: ReturnType<typeof create_field_proxy>;
  for(id: string): Descriptor;
};
function formDescriptor(): Descriptor {
  let input: Record<string, unknown> = {};
  const instances = new Map<string, Descriptor>();
  const fields = create_field_proxy({}, () => input,
    (path: Array<string | number>, value: unknown) => {
      if (path.length === 0) input = value as Record<string, unknown>;
      else deep_set(input, path.map(String), value);
    }, () => ({}));
  const descriptor = {
    method: 'POST', action: '',
    [createAttachmentKey()]: (form: HTMLFormElement) => {
      const rejectSubmission = (event: SubmitEvent) => {
        event.preventDefault();
        throw new Error('Schema DOM descriptor host does not execute form submissions');
      };
      form.addEventListener('submit', rejectSubmission);
      return () => form.removeEventListener('submit', rejectSubmission);
    }
  };
  // Kit exposes these APIs nonenumerably; only HTML props and the attachment spread.
  return Object.defineProperties(descriptor, {
    pending: { value: 0 }, result: { value: undefined }, fields: { value: fields },
    for: { value: (id: string) => {
      if (!instances.has(id)) instances.set(id, formDescriptor());
      return instances.get(id)!;
    } }
  }) as Descriptor;
}
export const createSchemaCollection = formDescriptor();
export const updateSchemaCollection = formDescriptor();
export const addSchemaField = formDescriptor();
export const updateSchemaFieldLabel = formDescriptor();
export const updateSchemaFieldOptions = formDescriptor();

// Present for the component's value import; controlled DOM fixtures supply definition directly.
export function getSchemaCollection(_slug: string): never {
  throw new Error('Schema DOM descriptor host does not execute collection queries');
}
