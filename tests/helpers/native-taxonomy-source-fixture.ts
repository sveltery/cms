// Test-only fixture for the unchanged taxonomy-checkbox callback.
// Real source terms, schema and lifecycle publication; no raw content status/pointers.
import {test as base,type Page} from '@playwright/test';
import {schemaAdminRemotes} from './schema-admin-remotes';
import {TaxonomyRepository} from '../../src/lib/server/taxonomies/upstream/database/repositories/taxonomy';
import {registerTaxonomyDatabase} from '../../src/lib/server/taxonomies/upstream/host';
import {handleTaxonomyList,handleTermCreate} from '../../src/lib/server/taxonomies/upstream/api/handlers/taxonomies';
interface Admin {goto(path:string):Promise<void>;goToEditContent(collection:string,id:string):Promise<void>;waitForLoading():Promise<void>;waitForShell():Promise<void>}
export const test=base.extend<{admin:Admin;serverInfo:{baseUrl:string;token:string;contentIds:Record<string,string[]>}}>({
 admin:async({page},use)=>{
  const h=await schemaAdminRemotes('Node');const nativeFetch=globalThis.fetch;try{
   registerTaxonomyDatabase(h.database);
   // Only source callback seed requests use this disclosed in-process domain adapter.
   // Browser requests continue through the actual built authenticated Kit server.
   globalThis.fetch=async(input,init)=>{const url=String(input);if(url.startsWith(h.origin+'/_emdash/api/taxonomies')){const path=new URL(url).pathname.split('/');const result=path.length===4?await handleTaxonomyList(h.database.db as any):await handleTermCreate(h.database.db as any,path[4],JSON.parse(String(init?.body)));return Response.json(result,{status:result.success?200:400});}return nativeFetch(input,init);};
   await h.registry.createCollection({slug:'posts',label:'Posts',supports:['drafts','revisions']});
   await h.registry.createField('posts',{slug:'title',label:'Title',type:'string'});
   const created=(await h.mutate('createLifecycleContent',{collection:'posts',data:JSON.stringify({title:'Published taxonomy post'})}))._.result;
   await h.mutate('publishContent',{collection:'posts',id:created.id,_rev:created._rev});
   const terms=new TaxonomyRepository(h.database.db as any);
   for(const [slug,label] of [['news','News'],['tutorials','Tutorials'],['opinion','Opinion']])await terms.create({name:'category',slug,label});
   // Every source identity is real and persists through the same database.
   const fixture={baseUrl:h.origin,token:h.tokens.admin,goto:async(path:string)=>{await page.goto(h.origin+path);},goToEditContent:async(collection:string,id:string)=>{await page.goto(`${h.origin}/content/${collection}/${id}`);},waitForLoading:async()=>{await page.getByRole('navigation',{name:'Workspace'}).waitFor();},waitForShell:async()=>{await page.getByRole('navigation',{name:'Workspace'}).waitFor();},postId:created.id};
   await page.context().addCookies([{name:'cms-session',value:h.tokens.admin,url:h.origin}]);
   await use(fixture);
  }finally{globalThis.fetch=nativeFetch;await h.close();}
 },serverInfo:async({admin},use)=>{await use({baseUrl:(admin as any).baseUrl,token:(admin as any).token,contentIds:{posts:[(admin as any).postId]}});}
});
export {expect} from '@playwright/test';
