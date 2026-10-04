// This bridge changes only module/environment resolution. RemoteForm behavior
// comes from the installed exact Kit implementation and all data reaches actual HTTP.
import { form } from '@sveltejs/kit/src/runtime/client/remote-functions/form.svelte.js';
import type { schemaAdminRemotes } from '../schema-admin-remotes';
export let fixture: Awaited<ReturnType<typeof schemaAdminRemotes>>;
const forms = new Map<string, ReturnType<typeof form>>();
export function useFixture(value: typeof fixture) { fixture = value; forms.clear(); }
function remote(name: string) {
  return { for(key: string) {
    let instance = forms.get(name);
    if (!instance) { instance = form(fixture.ids.get(name)!); forms.set(name, instance); }
    return instance.for(key);
  } };
}
export const createContent = remote('createContent');
export const updateContent = remote('updateContent');
export const deleteContent = remote('deleteContent');
export const autosaveEditorDraft = remote('autosaveEditorDraft');
export function getContent(key: { collection: string; id: string; locale: string }) {
  let value = fixture.query('getContent', key, 'author');
  return { refresh: async () => { value = fixture.query('getContent', key, 'author'); await value; },
    then: (...args: Parameters<Promise<unknown>['then']>) => value.then(...args) };
}
