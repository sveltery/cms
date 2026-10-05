import { afterEach, expect, it, vi } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import FieldEditor from '../../src/lib/schema-admin/FieldEditor.svelte';
import List from '../../src/lib/schema-admin/ContentTypeList.svelte';
import Editor from '../../src/lib/schema-admin/ContentTypeEditor.svelte';
import { nativeProps } from '../helpers/schema-ui/state.svelte';
const mounted: ReturnType<typeof mount>[] = [];
afterEach(async () => { for (const instance of mounted.splice(0)) await unmount(instance); document.body.replaceChildren(); });
const collection = {id:'posts',slug:'posts',label:'Posts',source:'manual',supports:['drafts'],hasSeo:false};
const client = {fetchCollections:async()=>[collection],fetchRelations:async()=>[]};
async function list(props: object = {}) { const target=document.createElement('section');document.body.append(target);mounted.push(mount(List,{target,props:{collections:[collection],client,...props}}));await tick();return target; }
it('uses the actual Native relations URL without the Source router fixture projection', async () => {
  const target=document.createElement('section');document.body.append(target);
  mounted.push(mount(FieldEditor,{target,props:{open:true,onOpenChange:()=>{},onSave:()=>{},field:{slug:'related',label:'Related',type:'reference',validation:{targetCollection:'posts'}},client}}));await tick();
  expect(target.querySelector('a')?.getAttribute('href')).toBe('/schema/relations');
});
it('keeps the deletion confirmation and displays the actual mutation failure', async () => {
  const onDelete=vi.fn(async()=>{throw new Error('Content type still has content');});const target=await list({onDelete});
  target.querySelector<HTMLButtonElement>('button[aria-label="Delete Posts"]')!.click();await tick();
  [...target.querySelectorAll<HTMLButtonElement>('dialog button')].find(button=>button.textContent==='Delete')!.click();
  await vi.waitFor(()=>expect(target.querySelector('dialog')?.textContent).toContain('Content type still has content'));
  expect(onDelete).toHaveBeenCalledTimes(1);
});
it('disables collection deletion when the trusted page capability denies schema mutations', async () => {
  const target=await list({disabled:true});expect(target.querySelector<HTMLButtonElement>('button[aria-label="Delete Posts"]')?.disabled).toBe(true);
});
it('saves chosen title/date fields and list columns through the actual editor callback without dropping retained admin settings', async () => {
  const onSave=vi.fn(), target=document.createElement('section');document.body.append(target);
  const definition={...collection,labelSingular:'Post',description:'',routable:true,editLocking:true,hidden:false,hasSeo:false,commentsEnabled:false,commentsModeration:'first_time',commentsClosedAfterDays:90,commentsAutoApproveUsers:true,admin:{quickCreate:false},fields:[{id:'title',slug:'title',label:'Title',type:'string'},{id:'event',slug:'event',label:'Event',type:'datetime'}]};
  mounted.push(mount(Editor,{target,props:{collection:definition,onSave,client}}));await tick();
  const title=target.querySelector<HTMLSelectElement>('select[name="titleField"]'), date=target.querySelector<HTMLSelectElement>('select[name="dateField"]'), columns=target.querySelector<HTMLInputElement>('input[name="listColumns"]');
  expect(title).not.toBeNull();expect(date).not.toBeNull();expect(columns).not.toBeNull();
  title!.value='title';title!.dispatchEvent(new Event('change',{bubbles:true}));date!.value='event';date!.dispatchEvent(new Event('change',{bubbles:true}));columns!.value='title,event';columns!.dispatchEvent(new Event('input',{bubbles:true}));await tick();
  target.querySelector<HTMLFormElement>('form')!.requestSubmit();
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({titleField:'title',dateField:'event',admin:{quickCreate:false,listColumns:['title','event']}}));
});
it('retains a field dialog and reports the actual asynchronous save failure', async () => {
  const target=document.createElement('section');document.body.append(target);const onSave=vi.fn(async()=>{throw new Error('Field metadata needs a migration');});
  mounted.push(mount(FieldEditor,{target,props:{open:true,onOpenChange:()=>{},onSave,field:{slug:'title',label:'Title',type:'string'},client}}));await tick();
  [...target.querySelectorAll<HTMLButtonElement>('button')].find(button=>button.textContent==='Update Field')!.click();
  await vi.waitFor(()=>expect(target.querySelector('[role="alert"]')?.textContent).toBe('Field metadata needs a migration'));
  expect(target.querySelector('dialog')).not.toBeNull();
});
it('keeps the collection read model unchanged when repeater configuration is edited and cancelled', async () => {
  const definition=nativeProps({type:'repeater',slug:'items',label:'Items',validation:{subFields:[{slug:'title',label:'Original label',type:'string',required:false}]}}) as any;
  const target=document.createElement('section');document.body.append(target);
  mounted.push(mount(FieldEditor,{target,props:{open:true,onOpenChange:()=>{},onSave:()=>{},field:definition,client}}));await tick();
  const input=[...target.querySelectorAll<HTMLLabelElement>('label')].find(label=>label.textContent?.startsWith('Sub-field label'))!.querySelector('input')!;
  input.value='Unsaved label';input.dispatchEvent(new Event('input',{bubbles:true}));await tick();
  [...target.querySelectorAll<HTMLButtonElement>('button')].find(button=>button.textContent==='Cancel')!.click();
  expect(definition.validation.subFields[0].label).toBe('Original label');
});
it('retains field deletion confirmation when the real asynchronous mutation rejects', async () => {
  const target=document.createElement('section');document.body.append(target);
  const onDeleteField=vi.fn(async()=>{throw new Error('Field is still used by a relationship');});
  mounted.push(mount(Editor,{target,props:{collection:{...collection,fields:[{id:'title',slug:'title',label:'Title',type:'string'}]},onDeleteField,client}}));await tick();
  target.querySelector<HTMLButtonElement>('button[aria-label="Delete Title field"]')!.click();await tick();
  [...target.querySelectorAll<HTMLButtonElement>('dialog button')].find(button=>button.textContent==='Delete')!.click();
  await vi.waitFor(()=>expect(target.querySelector('dialog [role="alert"]')?.textContent).toBe('Field is still used by a relationship'));
  expect(onDeleteField).toHaveBeenCalledWith('title',undefined);
});
