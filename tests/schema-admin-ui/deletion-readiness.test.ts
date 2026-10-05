// Controlled handler delegation only: no HTTP server, identity, origin, session,
// credential, signature, race or canonical graph result is supplied or tested.
import { beforeEach, expect, it, vi } from 'vitest';
import { json } from '@sveltejs/kit';
const { deletion } = vi.hoisted(()=>({deletion:vi.fn(async()=>{})}));
vi.mock('../../src/lib/server/schema/admin-http',()=>({schemaAdminHttp:async(_event:unknown,_mutation:boolean,run:(service:unknown)=>Promise<unknown>)=>{
  try { return json({success:true,data:await run({deleteSchemaCollection:deletion,deleteSchemaField:deletion})}); }
  catch(cause:any) { return json({success:false,error:{code:cause.code,message:cause.message}},{status:cause.status ?? 500}); }
}}));
import { DELETE as collectionDelete } from '../../src/routes/api/schema/collections/[collection]/+server';
import { DELETE as fieldDelete } from '../../src/routes/api/schema/collections/[collection]/fields/[field]/+server';
beforeEach(()=>deletion.mockClear());
it.each([['collection',collectionDelete],['field',fieldDelete]] as const)('holds actual %s destructive route delegation until reference cleanup is available',async(_name,handler)=>{
  const event={params:{collection:'posts',field:'title'},request:new Request('https://example.test/api/schema/collections/posts',{method:'DELETE',body:JSON.stringify({force:false})})};
  const response=await handler(event as any);
  expect(response.status).toBe(503);
  expect((await response.json()).success).toBe(false);
  expect(deletion).not.toHaveBeenCalled();
});
