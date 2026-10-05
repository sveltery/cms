import { afterEach, expect, it, vi } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import FieldEditor from '../../src/lib/schema-admin/FieldEditor.svelte';
import List from '../../src/lib/schema-admin/ContentTypeList.svelte';
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
