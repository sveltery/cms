// Actual Source client -> Kit delegate -> sole canonical media owner.
// Controlled Source Role fixture only; no live session, credentials or HTTP server.
import {expect,it,vi} from 'vitest';
import type {RequestEvent} from '@sveltejs/kit';
import {openSqlite} from '../../src/lib/server/database/sqlite.ts';
import {migrateCms} from '../../src/lib/server/database/migrations.ts';
import {servicePrincipal} from '../../src/lib/server/auth/composition.ts';
import {Role} from '../../src/lib/server/auth/roles.ts';
import {MediaRepository} from '../../src/lib/server/general-media/index.ts';
import {fetchMediaList,fetchMediaItem,fetchMediaUsageDetails,createMediaFolder,fetchMediaFolder,updateMedia} from '../../src/lib/media/source/api/media.ts';
const modules=import.meta.glob('../../src/routes/**/+server.ts');

it('connects the complete Source media client to canonical read, folder and metadata operations',async()=>{
 const database=openSqlite(':memory:');
 try {
  await migrateCms(database);
  const repository=new MediaRepository(database);
  const item=await repository.create({filename:'actual-client.png',mimeType:'image/png',storageKey:'actual-client.png',authorId:'source-client-owner'});
  const required=['_emdash/api/media','_emdash/api/media/[id]','_emdash/api/media/folders','_emdash/api/media/folders/[id]'];
  for(const path of required)expect(modules[`../../src/routes/${path}/+server.ts`],path).toBeTypeOf('function');
  vi.stubGlobal('fetch',async(input:string|URL|Request,init:RequestInit={})=>{
   const url=new URL(input instanceof Request?input.url:String(input),'http://localhost');
   const headers=new Headers(init.headers);headers.set('Origin','http://localhost');
   const request=new Request(url,{...init,headers});
   const folder=/^\/_emdash\/api\/media\/folders\/([^/]+)$/.exec(url.pathname);
   // Match Kit's static folders route before its dynamic media-id sibling.
   const media=url.pathname==='/_emdash/api/media/folders'?null:/^\/_emdash\/api\/media\/([^/]+)$/.exec(url.pathname);
   const path=folder?'_emdash/api/media/folders/[id]':media?'_emdash/api/media/[id]':url.pathname.slice(1);
   const load=modules[`../../src/routes/${path}/+server.ts`];
   if(!load)throw new Error(`Actual media route absent: ${path}`);
   const routes=await load() as Record<string,(event:RequestEvent)=>Promise<Response>>;
   return routes[request.method]!({request,url,params:{id:decodeURIComponent(folder?.[1]??media?.[1]??'')},locals:{cms:{database,mutationsEnabled:true,principal:servicePrincipal({id:'source-client-owner',role:Role.EDITOR})},cmsRuntime:{publicOrigin:'http://localhost',basePath:'',rpName:'CMS'}}} as unknown as RequestEvent);
  });
  const page=await fetchMediaList({page:1,limit:35,search:'actual-client',folderId:null});
  expect(page.totalCount).toBe(1);expect(page.items[0]?.id).toBe(item.id);
  expect((await fetchMediaItem(item.id)).storageKey).toBe(item.storageKey);
  const folder=await createMediaFolder('Actual Source client');
  expect(await fetchMediaFolder(folder.id)).toEqual(folder);
  const updated=await updateMedia(item.id,{folderId:folder.id,alt:'Saved through actual Source client'});
  expect(updated.alt).toBe('Saved through actual Source client');
  expect((await repository.findById(item.id))?.folderId).toBe(folder.id);
  expect((await fetchMediaList({folderId:folder.id})).items.map(value=>value.id)).toEqual([item.id]);
 } finally {vi.unstubAllGlobals();await database.close();}
});

it('reads real canonical usage through the Source client and GET-only application route',async()=>{
 const database=openSqlite(':memory:');
 try {
  await migrateCms(database);
  const item=await new MediaRepository(database).create({filename:'used.png',mimeType:'image/png',storageKey:'used.png'});
  const load=modules['../../src/routes/_emdash/api/media/[id]/usage/+server.ts'];
  expect(load,'Actual Source usage route').toBeTypeOf('function');
  const routes=await load!() as Record<string,(event:RequestEvent)=>Promise<Response>>;
  expect(Object.keys(routes).filter(key=>['GET','POST','PUT','PATCH','DELETE'].includes(key))).toEqual(['GET']);
  vi.stubGlobal('fetch',async(input:string|URL|Request,init:RequestInit={})=>{
   const url=new URL(input instanceof Request?input.url:String(input),'http://localhost');
   const request=new Request(url,init);
   return routes.GET!({request,url,params:{id:item.id},locals:{cms:{database,mutationsEnabled:true,principal:servicePrincipal({id:'source-client-owner',role:Role.EDITOR})},cmsRuntime:{publicOrigin:'http://localhost',basePath:'',rpName:'CMS'}}} as unknown as RequestEvent);
  });
  expect(await fetchMediaUsageDetails(item.id)).toEqual({items:[],siteSettings:[],coverage:{scope:'all_content_collections',status:'complete'}});
 } finally {vi.unstubAllGlobals();await database.close();}
});
