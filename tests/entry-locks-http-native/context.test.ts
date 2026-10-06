// Native controlled Request/principal/handler mocks. No real protected HTTP/session/storage credit.
import {afterEach,beforeEach,expect,test,vi} from 'vitest';
import {openSqlite} from '../../src/lib/server/database/sqlite.ts';
import {CmsError} from '../../src/lib/server/database/contract.ts';
import type {ServerPrincipal} from '../../src/lib/server/database/service.ts';
import {entryLockHttp} from '../../src/lib/server/entry-locks/http.ts';
const controls=vi.hoisted(()=>({get:vi.fn(),service:vi.fn(),read:vi.fn(),acquire:vi.fn(),release:vi.fn()}));
vi.mock('../../src/lib/server/database/lifecycle/service.ts',()=>({lifecycleService:(...args:unknown[])=>{controls.service(...args);return{getContent:(...values:unknown[])=>controls.get(...values)};}}));
vi.mock('../../src/lib/server/entry-locks/handlers.ts',()=>({
 handleEntryLockRead:(...args:unknown[])=>controls.read(...args),
 handleEntryLockAcquire:(...args:unknown[])=>controls.acquire(...args),
 handleEntryLockRelease:(...args:unknown[])=>controls.release(...args)
}));
const principal:ServerPrincipal={id:'writer',permissions:['content:read','content:read_drafts','content:edit_own']};
const holder={userId:'writer',userName:'Writer',acquiredAt:'2026-09-04T10:00:00.000Z',expiresAt:'2026-09-04T10:07:00.000Z'};
const status={enabled:true,holder,heldByCaller:true};
let database:ReturnType<typeof openSqlite>;
beforeEach(()=>{
 database=openSqlite(':memory:');for(const fn of Object.values(controls))fn.mockReset();
 controls.get.mockResolvedValue({id:'resolved-entry',authorId:'writer'});
 controls.read.mockResolvedValue({success:true,data:status});controls.acquire.mockResolvedValue({success:true,data:status});controls.release.mockResolvedValue({success:true,data:{released:true}});
});
afterEach(async()=>{await database.close();});
function event(method:'GET'|'POST'|'DELETE',options:{query?:string;body?:string;principal?:ServerPrincipal|null;mutationsEnabled?:boolean;origin?:string}={}){
 const url=new URL('http://localhost/api/content/posts/slug/lock'+(options.query??''));
 const headers:Record<string,string>={'Content-Type':'application/json',Origin:options.origin??'http://localhost'};
 const request=new Request(url,{method,headers,...(options.body===undefined?{}:{body:options.body})});
 return{request,url,params:{collection:'posts',id:'slug'},locals:{cms:{database,principal:options.principal===undefined?principal:options.principal,mutationsEnabled:options.mutationsEnabled??true},cmsRuntime:{publicOrigin:'http://localhost',basePath:'',rpName:'Controlled'}}};
}
test('GET passes actual resolved entry, explicit locale and caller to the sole handler',async()=>{
 const response=await entryLockHttp(event('GET',{query:'?locale=fr'}),'GET');
 expect(controls.get).toHaveBeenCalledWith({type:'posts',id:'slug',locale:'fr'},{inferLocale:false,resolveIdentifier:true});
 expect(controls.read).toHaveBeenCalledWith(database,'posts','resolved-entry','writer');
 expect(response.status).toBe(200);expect(await response.json()).toEqual({success:true,data:status});expect(response.headers.get('Cache-Control')).toBe('private, no-store');
});
test('POST keeps takeover and tab token and omitted locale unchanged',async()=>{
 const response=await entryLockHttp(event('POST',{body:JSON.stringify({takeover:true,token:'controlled-tab'})}),'POST');
 expect(controls.get).toHaveBeenCalledWith({type:'posts',id:'slug'},{inferLocale:true,resolveIdentifier:true});
 expect(controls.acquire).toHaveBeenCalledWith(database,'posts','resolved-entry','writer',{takeover:true,token:'controlled-tab'});expect(response.status).toBe(200);
});
test('DELETE forwards the exact query tab token to the resolved entry',async()=>{
 const response=await entryLockHttp(event('DELETE',{query:'?locale=fr&token=latest-tab%20value'}),'DELETE');
 expect(controls.release).toHaveBeenCalledWith(database,'posts','resolved-entry','writer',{token:'latest-tab value'});expect(await response.json()).toEqual({success:true,data:{released:true}});
});
test('permission denial after read resolution prevents every holder handler',async()=>{
 const response=await entryLockHttp(event('GET',{principal:{id:'other',permissions:['content:read','content:read_drafts','content:edit_own']}}),'GET');
 expect(response.status).toBe(403);expect(await response.json()).toMatchObject({success:false,error:{code:'INSUFFICIENT_PERMISSIONS'}});
 expect(controls.read).not.toHaveBeenCalled();expect(controls.acquire).not.toHaveBeenCalled();expect(controls.release).not.toHaveBeenCalled();
});
test('an actual get permission failure is preserved before holder disclosure',async()=>{
 controls.get.mockRejectedValue(new CmsError('FORBIDDEN'));
 const response=await entryLockHttp(event('GET'),'GET');expect(response.status).toBe(403);expect(controls.read).not.toHaveBeenCalled();
});
test('Source optional body validation rejects a nonboolean takeover before resolving content',async()=>{
 const response=await entryLockHttp(event('POST',{body:'{"takeover":"true"}'}),'POST');
 expect(response.status).toBe(400);expect(controls.get).not.toHaveBeenCalled();expect(controls.acquire).not.toHaveBeenCalled();
});
test('Source disabled collection status and handler errors retain their actual response shapes',async()=>{
 controls.acquire.mockResolvedValue({success:true,data:{enabled:false,holder:null,heldByCaller:false}});
 expect(await(await entryLockHttp(event('POST'),'POST')).json()).toEqual({success:true,data:{enabled:false,holder:null,heldByCaller:false}});
 controls.read.mockResolvedValue({success:false,error:{code:'ENTRY_LOCK_ERROR',message:'Failed to read the entry lock'}});
 const response=await entryLockHttp(event('GET'),'GET');expect(response.status).toBe(500);expect(await response.json()).toEqual({success:false,error:{code:'ENTRY_LOCK_ERROR',message:'Failed to read the entry lock'}});
});
test('trusted mutation flag and actual existing origin predicate run before the controlled handlers',async()=>{
 expect((await entryLockHttp(event('POST',{mutationsEnabled:false}),'POST')).status).toBe(503);
 expect((await entryLockHttp(event('DELETE',{origin:'http://untrusted.invalid'}),'DELETE')).status).toBe(403);
 expect(controls.get).not.toHaveBeenCalled();expect(controls.acquire).not.toHaveBeenCalled();expect(controls.release).not.toHaveBeenCalled();
});
test('an absent controlled principal is denied before service composition',async()=>{
 expect((await entryLockHttp(event('GET',{principal:null}),'GET')).status).toBe(401);expect(controls.service).not.toHaveBeenCalled();expect(controls.read).not.toHaveBeenCalled();
});
