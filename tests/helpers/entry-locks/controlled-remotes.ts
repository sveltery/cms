// Error-only controlled transport; the exact installed Kit RemoteForm owns behavior.
// No successful backend/session/storage result is supplied by this fixture.
import {form} from 'sveltery-test:installed-kit-form';
const forms=new Map<string,ReturnType<typeof form>>();
export function resetControlledForms(){forms.clear();}
function remote(name:string){return new Proxy({} as ReturnType<typeof form>,{get(_target,key){
 let current=forms.get(name);if(!current){current=form('entry-lock-controlled-'+name);forms.set(name,current);}
 const value=Reflect.get(current,key);return typeof value==='function'?value.bind(current):value;
}});}
export const createContent=remote('createContent');
export const updateContent=remote('updateContent');
export const deleteContent=remote('deleteContent');
export const autosaveEditorDraft=remote('autosaveEditorDraft');
export function getContent():never{throw new Error('This error-only fixture does not supply successful content queries');}
