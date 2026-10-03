// Test-only fixture for the unchanged taxonomy-checkbox callback.
// Real source terms, schema and lifecycle publication; no raw content status/pointers.
import {test as base,type Page} from '@playwright/test';
import {schemaAdminRemotes} from './schema-admin-remotes';
import {TaxonomyRepository} from '../../src/lib/server/taxonomies/upstream/database/repositories/taxonomy';
interface Admin {goToEditContent(collection:string,id:string):Promise<void>;waitForLoading():Promise<void>;waitForShell():Promise<void>}
export const test=base.extend<{admin:Admin;serverInfo:{contentIds:Record<string,string[]>}}>({
 admin:async({page},use)=>{
  const h=await schemaAdminRemotes('Node');try{
   await h.registry.createCollection({slug:'posts',label:'Posts',supports:['drafts','revisions']});
   await h.registry.createField('posts',{slug:'title',label:'Title',type:'string'});
   const created=(await h.mutate('createLifecycleContent',{collection:'posts',data:JSON.stringify({title:'Published taxonomy post'})}))._.result;
   await h.mutate('publishContent',{collection:'posts',id:created.id,_rev:created._rev});
   const terms=new TaxonomyRepository(h.database.db as any);
   for(const [slug,label] of [['news','News'],['tutorials','Tutorials'],['opinion','Opinion']])await terms.create({name:'category',slug,label});
   // Every source identity is real and persists through the same database.
   const fixture={goToEditContent:async(collection:string,id:string)=>{await page.goto(`${h.origin}/content/${collection}/${id}`);},waitForLoading:async()=>{await page.getByRole('navigation',{name:'Workspace'}).waitFor();},waitForShell:async()=>{await page.getByRole('navigation',{name:'Workspace'}).waitFor();},postId:created.id};
   await page.context().addCookies([{name:'cms-session',value:h.tokens.admin,url:h.origin}]);
   await use(fixture);
  }finally{await h.close();}
 },serverInfo:async({admin},use)=>{await use({contentIds:{posts:[(admin as any).postId]}});}
});
export {expect} from '@playwright/test';
