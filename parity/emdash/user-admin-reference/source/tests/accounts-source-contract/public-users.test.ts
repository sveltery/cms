// Original qualifier executes complete pinned PUBLIC route+decoder+schema+adapter on real Source schema.
// No copied Source declaration credit, signed credential, concurrency or replay investigation.
import {test,expect,beforeEach,afterEach} from 'vitest';
import {setupTestDatabase,teardownTestDatabase} from '../helpers/accounts-source-db.ts';
import {createKyselyAdapter} from '../fixtures/accounts/packages/auth/src/adapters/kysely.ts';
import {GET as list} from '../fixtures/accounts/packages/core/src/astro/routes/api/admin/users/index.ts';
import {GET as detail,PUT as update} from '../fixtures/accounts/packages/core/src/astro/routes/api/admin/users/[id]/index.ts';
import {POST as disable} from '../fixtures/accounts/packages/core/src/astro/routes/api/admin/users/[id]/disable.ts';
import {POST as enable} from '../fixtures/accounts/packages/core/src/astro/routes/api/admin/users/[id]/enable.ts';
let db:any,adapter:any,admin:any,author:any;
beforeEach(async()=>{db=await setupTestDatabase();adapter=createKyselyAdapter(db);admin=await adapter.createUser({email:'admin@example.test',name:'Admin',role:50});author=await adapter.createUser({email:'author@example.test',name:'Author',role:30});});
afterEach(async()=>{await teardownTestDatabase(db);});
function context(id?:string,body?:unknown,user=admin){const url=new URL('https://example.test/_emdash/api/admin/users'+(id?'/'+id:''));return {url,params:{id},locals:{emdash:{db},user},request:new Request(url,{method:body===undefined?'GET':'PUT',...(body===undefined?{}:{headers:{'content-type':'application/json'},body:JSON.stringify(body)})})} as any;}
test('complete public Source list reports actual users and credential metadata',async()=>{const res=await list(context());expect(res.status).toBe(200);const body=await res.json();expect(body.data.items.map((u:any)=>u.email).sort()).toEqual(['admin@example.test','author@example.test']);expect(body.data.items[0].credentialCount).toBe(0);expect(body.data.items[0].oauthProviders).toEqual([]);});
test('complete public Source list denies anonymous and non-admin',async()=>{for(const user of [null,author])expect((await list(context(undefined,undefined,user))).status).toBe(403);});
test('complete public Source detail reports actual profile and no stored credentials',async()=>{const res=await detail(context(author.id));expect(res.status).toBe(200);const body=await res.json();expect(body.data.item.name).toBe('Author');expect(body.data.item.credentials).toEqual([]);});
test('complete public Source update persists profile and valid role',async()=>{const res=await update(context(author.id,{name:'New Name',role:40}));expect(res.status).toBe(200);expect((await adapter.getUserById(author.id)).name).toBe('New Name');expect((await adapter.getUserById(author.id)).role).toBe(40);});
test('complete public Source update refuses own-role changes',async()=>{const res=await update(context(admin.id,{role:40}));expect(res.status).toBe(400);expect((await res.json()).error.code).toBe('SELF_ROLE_CHANGE');expect((await adapter.getUserById(admin.id)).role).toBe(50);});
test('complete public Source update rejects invalid role before persisted writes',async()=>{const res=await update(context(author.id,{role:41}));expect(res.status).toBe(400);expect((await res.json()).error.code).toBe('VALIDATION_ERROR');expect((await adapter.getUserById(author.id)).role).toBe(30);});
test('complete public Source update rejects duplicate email',async()=>{const res=await update(context(author.id,{email:admin.email}));expect(res.status).toBe(409);expect((await res.json()).error.code).toBe('EMAIL_IN_USE');});
test('complete public Source disable and enable persist actual disabled state',async()=>{expect((await disable(context(author.id))).status).toBe(200);expect((await adapter.getUserById(author.id)).disabled).toBe(true);expect((await enable(context(author.id))).status).toBe(200);expect((await adapter.getUserById(author.id)).disabled).toBe(false);});
test('complete public Source refuses self disable',async()=>{const res=await disable(context(admin.id));expect(res.status).toBe(400);expect((await res.json()).error.message).toBe('Cannot disable your own account');});
