// Original native public controls, not Source Astro/inline-script parity.
import {afterEach,expect,it,vi} from 'vitest';
import {mount,flushSync,tick,unmount} from 'svelte';
import Form from '../../src/lib/comments/CommentForm.svelte';
import Comments from '../../src/lib/comments/Comments.svelte';
const instances:Array<ReturnType<typeof mount>>=[];
afterEach(async()=>{for(const instance of instances.splice(0))await unmount(instance);document.body.replaceChildren();vi.unstubAllGlobals();});
function attach(component:typeof Form|typeof Comments,props:{collection:string;contentId:string}&Record<string,unknown>){const target=document.createElement('div');document.body.append(target);instances.push(flushSync(()=>mount(component,{target,props:{enabled:true,...props}})));return target;}
const comment={id:'comment-1',authorName:'Jane',isRegisteredUser:false,body:'<script>bad()</script> https://example.com/page',parentId:null,createdAt:'2026-01-01T00:00:00Z'};
it('submits visitor details, body, parent and honeypot through the registered native endpoint',async()=>{
 const transport=vi.fn().mockResolvedValue(Response.json({success:true,data:{status:'pending',message:'Comment submitted for review'}},{status:201}));vi.stubGlobal('fetch',transport);
 const target=attach(Form,{collection:'posts',contentId:'post-1',parentId:'parent-1'});const name=target.querySelector<HTMLInputElement>('input[name="authorName"]');expect(name).not.toBeNull();name!.value='Jane';target.querySelector<HTMLInputElement>('input[name="authorEmail"]')!.value='jane@example.com';target.querySelector<HTMLTextAreaElement>('textarea')!.value='Public reply';target.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await tick();await tick();
 expect(transport).toHaveBeenCalledWith('/api/comments/posts/post-1',expect.objectContaining({method:'POST',body:JSON.stringify({authorName:'Jane',authorEmail:'jane@example.com',website_url:'',body:'Public reply',parentId:'parent-1'})}));expect(target.textContent).toContain('Comment submitted!');
});
it('prefills supplied trusted presentation and clears only the body after success',async()=>{
 const transport=vi.fn().mockResolvedValue(Response.json({success:true,data:{status:'approved'}},{status:201}));vi.stubGlobal('fetch',transport);
 const target=attach(Form,{collection:'posts',contentId:'post-1',user:{name:'Current Author',email:'author@example.com'}});expect(target.textContent).toContain('Current Author');expect(target.querySelector('input[name="authorName"]')).toBeNull();target.querySelector<HTMLTextAreaElement>('textarea')!.value='Registered comment';target.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await tick();await tick();expect(JSON.parse(transport.mock.calls[0][1].body)).toMatchObject({authorName:'Current Author',authorEmail:'author@example.com',body:'Registered comment'});expect(target.querySelector<HTMLTextAreaElement>('textarea')!.value).toBe('');
});
it('renders safe source-formatted body and threaded replies without private fields',()=>{
 const target=attach(Comments,{collection:'posts',contentId:'post-1',comments:[{...comment,replies:[{...comment,id:'reply-1',parentId:'comment-1',body:'A reply'}]}],total:2,threaded:true});expect(target.textContent).toContain('<script>bad()</script>');expect(target.querySelector('script')).toBeNull();const link=target.querySelector('a');expect(link?.href).toBe('https://example.com/page');expect(link?.rel).toBe('nofollow ugc noopener');expect(target.textContent).toContain('A reply');
});
it('toggles real reaction transport and projects returned count and pressed state',async()=>{
 const transport=vi.fn().mockImplementation((_url:string,init?:RequestInit)=>Promise.resolve(Response.json({success:true,data:init?.method==='POST'?{reacted:true,counts:{like:2}}:{viewer:{}}})));vi.stubGlobal('fetch',transport);
 const target=attach(Comments,{collection:'posts',contentId:'post-1',comments:[comment],total:1,reactions:true});await tick();const button=target.querySelector<HTMLButtonElement>('button[data-ec-reaction="like"]');expect(button).not.toBeNull();button!.click();await vi.waitFor(()=>expect(button!.getAttribute('aria-pressed')).toBe('true'));expect(button!.textContent).toContain('2');expect(transport).toHaveBeenCalledWith('/api/comments/posts/post-1/reactions',expect.objectContaining({method:'POST',body:JSON.stringify({commentId:'comment-1',reaction:'like'})}));
});
