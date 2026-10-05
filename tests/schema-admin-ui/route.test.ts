import { afterEach, expect, it, vi } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import { setCollection } from '../helpers/schema-ui/kit-state.svelte';
const { getCollection } = vi.hoisted(() => ({ getCollection: vi.fn(async (slug: string) => ({ id:slug,slug,label:slug === 'posts'?'Posts':'Pages',source:'manual',supports:['drafts'],hasSeo:false,fields:[] })) }));
vi.mock('../../src/lib/schema-admin/runtime-client',()=>({adminClient:{getCollection}}));
vi.mock('../../src/lib/schema-admin/client',()=>({fetchCollections:async()=>[],fetchRelations:async()=>[]}));
import Page from '../../src/routes/schema/_manage/[collection]/+page.svelte';
let instance:ReturnType<typeof mount>;
afterEach(async()=>{await unmount(instance);document.body.replaceChildren();setCollection('posts');getCollection.mockClear();});
it('reloads the actual collection page when Kit reuses it for a different collection parameter',async()=>{
  const target=document.createElement('section');document.body.append(target);
  instance=mount(Page,{target,props:{data:{canMutateSchema:true}}});await tick();
  await vi.waitFor(()=>expect(target.querySelector('h1')?.textContent).toBe('Posts'));
  setCollection('pages');await tick();
  await vi.waitFor(()=>expect(target.querySelector('h1')?.textContent).toBe('Pages'));
  expect(getCollection).toHaveBeenCalledWith('pages');
});
