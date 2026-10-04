// Original native DOM behavior; no Source browser/geometry credit.
import { afterEach, expect, it, vi } from 'vitest';
import { mount, flushSync, tick, unmount } from 'svelte';
import Inbox from '../../src/lib/comments/CommentInbox.svelte';
import type { CommentInboxProps, AdminComment } from '../../src/lib/comments/types.ts';
const mounted:Array<ReturnType<typeof mount>>=[];
afterEach(async()=>{for(const instance of mounted.splice(0))await unmount(instance);document.body.replaceChildren();});
function comment(id='comment-1'):AdminComment{return {id,collection:'posts',contentId:'post-1',parentId:null,authorName:'Jane',authorEmail:'jane@example.com',authorUserId:null,body:'Complete comment body',status:'pending',ipHash:null,userAgent:null,moderationMetadata:null,createdAt:'2026-01-01T00:00:00Z',updatedAt:'2026-01-01T00:00:00Z'};}
function fixture(patch:Partial<CommentInboxProps>={}){
 const props:CommentInboxProps={comments:[comment()],counts:{pending:1,approved:0,spam:0,trash:0},isLoading:false,collections:{posts:{label:'Posts'}},activeStatus:'pending',onStatusChange:vi.fn(),collectionFilter:'',onCollectionFilterChange:vi.fn(),searchQuery:'',onSearchChange:vi.fn(),onCommentStatusChange:vi.fn().mockResolvedValue(undefined),onCommentDelete:vi.fn().mockResolvedValue(undefined),onBulkAction:vi.fn().mockResolvedValue(undefined),onLoadMore:vi.fn(),isAdmin:true,isStatusPending:false,deleteError:null,onDeleteErrorReset:vi.fn(),...patch};
 const target=document.createElement('div');document.body.append(target);mounted.push(flushSync(()=>mount(Inbox,{target,props})));return {target,props};
}
function button(target:HTMLElement,label:string):HTMLButtonElement|null {return [...target.querySelectorAll('button')].find(element=>element.getAttribute('aria-label')===label||element.textContent?.trim()===label)??null;}
it('shows the source page context and sends a status tab change',async()=>{
 const {target,props}=fixture();expect(target.textContent).toContain('Review and moderate comments across your content.');
 const pending=target.querySelector('[role="tab"][aria-selected="true"]');expect(pending?.textContent).toContain('Pending');button(target,'Approved')!.click();await tick();expect(props.onStatusChange).toHaveBeenCalledWith('approved');
});
it('selects only the current twenty rows and bulk submits their original identities',async()=>{
 const {target,props}=fixture({comments:Array.from({length:21},(_,index)=>comment(`comment-${index}`))});
 const select=target.querySelector<HTMLInputElement>('input[aria-label="Select all"]');expect(select).not.toBeNull();select!.click();await tick();expect(target.textContent).toContain('20 selected');
 button(target,'Approve')!.click();await tick();expect(props.onBulkAction).toHaveBeenCalledWith(Array.from({length:20},(_,index)=>`comment-${index}`),'approve');
});
it('opens the complete detail and closes it on Escape',async()=>{
 const {target}=fixture();const body=button(target,'Complete comment body');expect(body).not.toBeNull();body!.click();await tick();expect(target.querySelector('[role="dialog"]')?.textContent).toContain('jane@example.com');document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await tick();expect(target.querySelector('[role="dialog"]')).toBeNull();
});
it('keeps delete confirmation available when the real supplied callback fails',async()=>{
 const {target,props}=fixture({onCommentDelete:vi.fn().mockRejectedValue(new Error('Delete failed'))});const remove=button(target,'Delete permanently');expect(remove).not.toBeNull();remove!.click();await tick();button(target,'Delete')!.click();await tick();await tick();expect(props.onCommentDelete).toHaveBeenCalledWith('comment-1');expect(target.querySelector('[role="dialog"]')?.textContent).toContain('Delete failed');
});
it('closes only the detail backdrop while clicks within the detail keep it open',async()=>{
 const {target}=fixture();button(target,'Complete comment body')!.click();await tick();
 const dialog=document.querySelector<HTMLElement>('[role="dialog"]');expect(dialog).not.toBeNull();dialog!.click();await tick();expect(document.querySelector('[role="dialog"]')).not.toBeNull();
 const backdrop=document.querySelector<HTMLElement>('.overlay');expect(backdrop).not.toBeNull();backdrop!.click();await tick();expect(document.querySelector('[role="dialog"]')).toBeNull();
});
