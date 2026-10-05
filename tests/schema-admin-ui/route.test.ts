import { afterEach, expect, it, vi } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import { setCollection } from '../helpers/schema-ui/kit-state.svelte';
const { getCollection, updateCollection } = vi.hoisted(() => ({ getCollection: vi.fn(async (slug: string) => ({ id:slug,slug,label:slug === 'posts'?'Posts':'Pages',source:'manual',supports:['drafts'],hasSeo:false,fields:[] })), updateCollection:vi.fn() }));
vi.mock('../../src/lib/schema-admin/runtime-client',()=>({adminClient:{getCollection,updateCollection}}));
vi.mock('../../src/lib/schema-admin/client',()=>({fetchCollections:async()=>[],fetchRelations:async()=>[]}));
import Page from '../../src/routes/schema/_manage/[collection]/+page.svelte';
let instance:ReturnType<typeof mount>;
afterEach(async()=>{await unmount(instance);document.body.replaceChildren();setCollection('posts');getCollection.mockClear();updateCollection.mockReset();});
it('reloads the actual collection page when Kit reuses it for a different collection parameter',async()=>{
  const target=document.createElement('section');document.body.append(target);
  instance=mount(Page,{target,props:{data:{canMutateSchema:true}}});await tick();
  await vi.waitFor(()=>expect(target.querySelector('h1')?.textContent).toBe('Posts'));
  setCollection('pages');await tick();
  await vi.waitFor(()=>expect(target.querySelector('h1')?.textContent).toBe('Pages'));
  expect(getCollection).toHaveBeenCalledWith('pages');
});
it('blocks field actions while the actual collection route waits for a prior schema save',async()=>{
  let release!:()=>void;updateCollection.mockImplementationOnce(()=>new Promise<void>(resolve=>{release=resolve;}));
  const target=document.createElement('section');document.body.append(target);
  instance=mount(Page,{target,props:{data:{canMutateSchema:true}}});await tick();
  await vi.waitFor(()=>expect(target.querySelector('h1')?.textContent).toBe('Posts'));
  const label=[...target.querySelectorAll<HTMLLabelElement>('label')].find(value=>value.textContent?.startsWith('Label (Plural)'))!.querySelector('input')!;
  label.value='Updated posts';label.dispatchEvent(new Event('input',{bubbles:true}));await tick();target.querySelector<HTMLFormElement>('form')!.requestSubmit();await tick();
  try { await vi.waitFor(()=>expect([...target.querySelectorAll<HTMLButtonElement>('button')].find(button=>button.textContent==='Add Field')?.disabled).toBe(true)); }
  finally { release();await tick(); }
});
