// Native mounted editor supplements with real installed Kit RemoteForm/binary parser.
// Error-only controlled responses and lease API seam; no successful HTTP/session/DB claim.
import {afterEach,beforeEach,expect,test,vi} from 'vitest';
import {flushSync,mount,tick,unmount} from 'svelte';
import {deserialize_binary_form} from 'sveltery-test:installed-kit-form-utils';
import {navigation} from '../helpers/writable-editor-dom/framework.ts';
import {resetControlledForms} from '../helpers/entry-locks/controlled-remotes.ts';
import {entryLockEditorState} from '../helpers/entry-locks/editor-state.svelte.ts';
import EntryLockEditor from '../../src/lib/entry-locks/EntryLockEditor.svelte';
import type {EditorCollection} from '../../src/lib/server/content/manifest.ts';
import type {EditorRecord} from '../../src/lib/editor/session.ts';
const controls=vi.hoisted(()=>({acquire:vi.fn(),release:vi.fn()}));
vi.mock('../../src/lib/entry-locks/client.ts',async importOriginal=>({
 ...await importOriginal<typeof import('../../src/lib/entry-locks/client.ts')>(),
 acquireEntryLock:(...args:unknown[])=>controls.acquire(...args),releaseEntryLock:(...args:unknown[])=>controls.release(...args)
}));
const ADA={userId:'user-ada',userName:'Ada',acquiredAt:'2026-09-04T10:00:00.000Z',expiresAt:'2026-09-04T10:07:00.000Z'};
const definition:EditorCollection={label:'Stories',labelSingular:'Story',supports:['drafts','revisions'],hasSeo:false,routable:false,fields:{
 title:{id:'title',kind:'string',type:'string',label:'Title',required:true,translatable:false}
}};
const original:EditorRecord={id:'entry-1',type:'stories',locale:'en',_rev:'rev1',status:'draft',slug:'story',data:{title:'Original'}};
let instance:ReturnType<typeof mount>|undefined,delay:Promise<void>|undefined,resolveDelay:(()=>void)|undefined;
let requests:{url:string;data:Record<string,unknown>}[]=[];
beforeEach(()=>{
 resetControlledForms();navigation.callbacks.length=0;navigation.urls.length=0;requests=[];delay=undefined;resolveDelay=undefined;
 controls.acquire.mockReset();controls.release.mockReset();controls.acquire.mockResolvedValue({enabled:true,heldByCaller:true,holder:ADA});controls.release.mockResolvedValue(undefined);
 vi.stubGlobal('fetch',async(input:string|URL|Request,init?:RequestInit)=>{
  if(typeof input!=='string'||!input.startsWith('/_app/remote/'))throw new Error('Unexpected request outside controlled error-only RemoteForm');
  const body=init?.body instanceof Blob?await new Promise<ArrayBuffer>((done,reject)=>{
   const reader=new FileReader();reader.onload=()=>done(reader.result as ArrayBuffer);reader.onerror=()=>reject(reader.error);reader.readAsArrayBuffer(init.body as Blob);
  }):init?.body;
  const request=new Request(new URL(input,'http://localhost'),{...init,body});
  const parsed=await deserialize_binary_form(request);requests.push({url:input,data:parsed.data});
  if(delay)await delay;
  return Response.json({type:'error',status:409,error:{message:'Ada is holding this entry',code:'ENTRY_LOCKED',details:ADA}},{status:409});
 });
});
afterEach(async()=>{resolveDelay?.();if(instance)await unmount(instance);instance=undefined;document.body.replaceChildren();vi.restoreAllMocks();vi.unstubAllGlobals();});
async function render(){
 const current=entryLockEditorState(original);const target=document.createElement('div');document.body.append(target);
 instance=flushSync(()=>mount(EntryLockEditor,{target,props:{collection:'stories',definition,get entry(){return current.entry;},canWrite:true,canTrash:true}}));
 await tick();await vi.waitFor(()=>expect(controls.acquire).toHaveBeenCalledTimes(1));await tick();return{current,target};
}
async function edit(target:HTMLElement){const field=target.querySelector('[data-field="title"]') as HTMLInputElement;field.value='Unsaved writer copy';field.dispatchEvent(new Event('input',{bubbles:true}));await tick();}
const trash=(target:HTMLElement)=>target.querySelector('form[aria-label="Move draft to trash"] button') as HTMLButtonElement;
test('actual mounted editor remains writable and can trash while its controller owns the lease',async()=>{
 const {target}=await render();expect((target.querySelector('fieldset') as HTMLFieldSetElement).disabled).toBe(false);expect(trash(target).disabled).toBe(false);
 expect((target.querySelector('input[name="id"]') as HTMLInputElement).value).toBe('entry-1');expect(requests).toHaveLength(0);
});
test('actual rejected installed Kit save reports the lock and gates fields and trash without losing typed data',async()=>{
 const {target}=await render();await edit(target);target.querySelector('form[aria-label="Edit draft"]')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
 await vi.waitFor(()=>expect(target.textContent).toContain('You no longer hold this entry'));
 expect((target.querySelector('fieldset') as HTMLFieldSetElement).disabled).toBe(true);expect(trash(target).disabled).toBe(true);
 expect((target.querySelector('[data-field="title"]') as HTMLInputElement).value).toBe('Unsaved writer copy');expect(requests).toHaveLength(1);
 expect(requests[0].data).toMatchObject({collection:'stories',id:'entry-1',locale:'en',_rev:'rev1'});expect(navigation.urls).toEqual([]);
});
test('actual rejected installed Kit trash reports the lock before the existing trash error presenter',async()=>{
 const {target}=await render();target.querySelector('form[aria-label="Move draft to trash"]')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
 await vi.waitFor(()=>expect(target.textContent).toContain('You no longer hold this entry'));
 expect((target.querySelector('fieldset') as HTMLFieldSetElement).disabled).toBe(true);expect(trash(target).disabled).toBe(true);expect(navigation.urls).toEqual([]);
 expect(requests).toHaveLength(1);expect(requests[0].data.id).toBe('entry-1');expect(target.textContent).toContain('Ada is holding this entry');
});
test('a late actual save refusal retains its captured old id and leaves the new entry writable',async()=>{
 const {target,current}=await render();delay=new Promise(done=>{resolveDelay=done;});await edit(target);
 target.querySelector('form[aria-label="Edit draft"]')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await vi.waitFor(()=>expect(requests).toHaveLength(1));
 current.entry={...original,id:'entry-2',data:{title:'Second entry'}};await tick();await vi.waitFor(()=>expect(controls.acquire).toHaveBeenCalledTimes(2));await tick();
 resolveDelay!();delay=undefined;await vi.waitFor(()=>expect(target.textContent).toContain('Ada is holding this entry'));await tick();
 expect(requests[0].data.id).toBe('entry-1');expect((target.querySelector('input[name="id"]') as HTMLInputElement).value).toBe('entry-2');
 expect((target.querySelector('fieldset') as HTMLFieldSetElement).disabled).toBe(false);expect(trash(target).disabled).toBe(false);expect(target.textContent).not.toContain('You no longer hold this entry');
});
