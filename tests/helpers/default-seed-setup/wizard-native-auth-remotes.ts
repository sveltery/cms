// TEST ONLY: actual Kit attached-form submit transport to identical Original API mocks.
// No real protected HTTP, option/challenge, credential, nonce, session or success stand-in.
import { createAttachmentKey } from 'svelte/attachments';
import { apiFetch, parseApiResponse } from '../../../parity/emdash/default-seed-setup-runtime/source/packages/admin/src/lib/api/client';
export { getSetupStatus } from './auth-remotes.ts';
const field = (name: string) => ({ as(type: string, value?: string) { return { name, type, value }; } });
let attachedForm: HTMLFormElement | undefined;
async function submit(form: HTMLFormElement) {
  const data = new FormData(form);
  const response = await apiFetch('/_emdash/api/setup/admin', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: data.get('email'), name: data.get('name') || undefined }) });
  beginSetup.result = await parseApiResponse(response, 'Failed to create admin');
  return true;
}
export const beginSetup = {
  fields: { email: field('email'), name: field('name'), allIssues: () => [] }, pending: 0, result: undefined as unknown,
  [createAttachmentKey()]: (element: HTMLFormElement) => {
    attachedForm = element;
    return () => { if (attachedForm === element) attachedForm = undefined; };
  },
  enhance: (callback: (value: { submit: () => Promise<void> }) => Promise<void>) => ({
    async onsubmit(event: SubmitEvent) {
      event.preventDefault();
      await callback({ submit: async () => { await submit(event.currentTarget as HTMLFormElement); } });
    }
  }),
  submit: async () => {
    if (!attachedForm) throw new Error('Cannot call submit() before the form is attached');
    return submit(attachedForm);
  }
};
export const completeSetup = {
  fields: { credential: field('credential') }, pending: 0, result: undefined,
  submit: () => { throw new Error('Native controlled test stops before enrollment verification'); }
};
