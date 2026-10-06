// Native domain controls derived from the five complete pinned runtime/setup
// consumers. Those Original files and clocks remain separately immutable.
import {randomUUID} from 'node:crypto';
import {sql,type KyselyPlugin} from 'kysely';
import {describe,it,expect,vi} from 'vitest';
import {schemaAdminStorage} from '../helpers/schema-admin-storage.ts';
import {migrateCms} from '../../src/lib/server/database/migrations.ts';
import {createInitLock} from '../../src/lib/server/redirects/init-lock.ts';
import {seedSourceDatabase} from '../../src/lib/server/seed/namespace.ts';
import {SchemaRegistry} from '../../src/lib/server/seed/registry.ts';
import {buildSeedCollectionCaptureFingerprint} from '../../src/lib/server/seed/fingerprint.ts';
import {OptionsRepository} from '../../src/lib/server/comments/upstream/database/repositories/options.ts';
import * as engine from '../../src/lib/server/seed/index.ts';

const fixtureSeed=vi.hoisted(()=>({value:{} as unknown}));
vi.mock('virtual:emdash/seed',()=>({get seed(){return fixtureSeed.value;},userSeed:null}));
function sourceSeed(){return{version:'1' as const,settings:{},collections:[
 {slug:'posts',label:'Posts',fields:[{slug:'hero',label:'Hero',type:'image' as const}]},
 {slug:'pages',label:'Pages',fields:[{slug:'title',label:'Title',type:'string' as const}]}
],content:{posts:[{id:'welcome',slug:'welcome',data:{hero:{id:'media-1',provider:'local',mimeType:'image/webp'}}}]}};}
async function fixture(target:'Node'|'D1'){
 const storage=await schemaAdminStorage(target);
 try{await migrateCms(storage.database);const db=seedSourceDatabase(storage.database);
  return{storage,db,options:new OptionsRepository(db),parameters:{databaseKey:`source-default-${randomUUID()}`,holder:{lock:createInitLock(),done:new Set<string>()},deadlineMs:30000}};
 }catch(error){await storage.close();throw error;}
}
for(const target of ['Node','D1']as const)describe(`${target}: real default/setup Seed domain`,()=>{
 it('activates capture before default schema and retains real subsequent content work',async()=>{
  const f=await fixture(target);try{
   fixtureSeed.value=sourceSeed();
   const initialize=Reflect.get(engine,'initializeDefaultSeed');
   const outcome=await initialize(f.db,f.parameters);
   expect(outcome).toMatchObject({attempted:true,complete:true});
   expect(await f.options.get('emdash:seed_complete')).toBe(true);
   const activation=(await sql`SELECT state,activated_at FROM _cms_media_usage_activation WHERE task_key='incremental_capture'`.execute(f.storage.database.db)).rows[0];
   expect(activation).toEqual({state:'active',activated_at:expect.any(String)});
   const collection=await new SchemaRegistry(f.db).getCollection('posts');expect(collection).not.toBeNull();
   await engine.applySeed(f.db,sourceSeed(),{includeContent:true,onConflict:'skip'});
   const content=await f.db.selectFrom('ec_posts' as never).select('id' as never).where('slug' as never,'=','welcome' as never).executeTakeFirstOrThrow();
   expect((await sql`SELECT collection_id,content_id,state FROM _cms_media_usage_work`.execute(f.storage.database.db)).rows).toEqual([{collection_id:collection!.id,content_id:Reflect.get(content,'id'),state:'pending'}]);
  }finally{await f.storage.close();}
 },30000);
 it('leaves an existing configured site inactive',async()=>{
  const f=await fixture(target);try{
   fixtureSeed.value=sourceSeed();await new SchemaRegistry(f.db).createCollection({slug:'articles',label:'Articles'});
   await f.options.set('emdash:setup_complete',true);
   const outcome=await Reflect.get(engine,'initializeDefaultSeed')(f.db,f.parameters);
   expect(outcome).toMatchObject({attempted:false,complete:false});
   expect((await sql`SELECT state,activated_at FROM _cms_media_usage_activation WHERE task_key='incremental_capture'`.execute(f.storage.database.db)).rows).toEqual([{state:'expanded',activated_at:null}]);
   expect((await new SchemaRegistry(f.db).listCollections()).map(c=>c.slug)).toEqual(['articles']);
  }finally{await f.storage.close();}
 },30000);
 it('does not mark an invalid default seed complete',async()=>{
  const f=await fixture(target);try{
   fixtureSeed.value={version:'unsupported'};
   const outcome=await Reflect.get(engine,'initializeDefaultSeed')(f.db,f.parameters);
   expect(outcome).toMatchObject({attempted:true,complete:false,validation:{valid:false}});
   expect(await f.options.get('emdash:seed_complete')).toBeNull();
   expect(await new SchemaRegistry(f.db).listCollections()).toEqual([]);
  }finally{await f.storage.close();}
 },30000);
 it('does not report completion or seed after an actual options read failure',async()=>{
  const f=await fixture(target);try{
   fixtureSeed.value=sourceSeed();
   const db=f.db.withPlugin({transformQuery({node}){
    if(node.kind==='SelectQueryNode'&&JSON.stringify(node.from).includes('"name":"options"'))throw new Error('Actual caller options observer read failure');
    return node;
   },async transformResult({result}){return result;}});
   const outcome=await Reflect.get(engine,'initializeDefaultSeed')(db,f.parameters);
   expect(outcome).toMatchObject({attempted:false,complete:false});
   expect(await f.options.get('emdash:seed_complete')).toBeNull();
   expect(await new SchemaRegistry(f.db).listCollections()).toEqual([]);
   expect((await sql`SELECT state FROM _cms_media_usage_activation WHERE task_key='incremental_capture'`.execute(f.storage.database.db)).rows).toEqual([{state:'expanded'}]);
  }finally{await f.storage.close();}
 },30000);
 it('resumes an interrupted default with the actual capture identity',async()=>{
  const f=await fixture(target);try{
   const seed=sourceSeed();fixtureSeed.value=seed;
   await Reflect.get(engine,'initializeDefaultSeed')(f.db,f.parameters);
   const pages=await new SchemaRegistry(f.db).getCollection('pages');if(!pages)throw Error('Missing real seeded pages');
   await sql`DELETE FROM _cms_fields WHERE collection_id=${pages.id}`.execute(f.storage.database.db);
   await sql`DELETE FROM _cms_collections WHERE id=${pages.id}`.execute(f.storage.database.db);
   const fingerprint=await buildSeedCollectionCaptureFingerprint({slug:'pages',label:'Pages',supports:[]},[{slug:'title',label:'Title',type:'string'}]);
   await sql`UPDATE _cms_media_usage_index_status SET capture_state='installing',cursor=${fingerprint} WHERE collection_id=${pages.id}`.execute(f.storage.database.db);
   await f.options.set('emdash:seed_complete',false);f.parameters.holder.done.clear();
   expect(await Reflect.get(engine,'initializeDefaultSeed')(f.db,f.parameters)).toMatchObject({attempted:true,complete:true});
   const resumed=await new SchemaRegistry(f.db).getCollectionWithFields('pages');
   expect(resumed?.id).toBe(pages.id);expect(resumed?.fields.map(field=>field.slug)).toEqual(['title']);
   expect(await f.options.get('emdash:seed_complete')).toBe(true);
  }finally{await f.storage.close();}
 },30000);
 it('continues the same112 setup entries with actual500-query budget and form overrides',async()=>{
  const f=await fixture(target);try{
   const slugs=['menu_items','experiences','gallery_items','pages'];
   fixtureSeed.value={version:'1',settings:{title:'Seed title',tagline:'Seed tagline'},collections:slugs.map(slug=>({slug,label:slug,fields:[{slug:'title',label:'Title',type:'string'},{slug:'body',label:'Body',type:'text'}]})),content:Object.fromEntries(slugs.map(slug=>[slug,Array.from({length:28},(_,index)=>({id:`${slug}-${index}`,slug:`${slug}-${index}`,data:{title:`Entry ${index}`,body:`Body ${index}`}}))]))};
   const counts:number[]=[],progress:{done:number,total:number}[]=[],entries:number[]=[];
   let complete=false;
   for(let call=0;call<20;call++){
    let queries=0;const observer:KyselyPlugin={transformQuery({node}){queries++;return node;},async transformResult({result}){return result;}};
    const outcome=await Reflect.get(engine,'applySetupSeedWithinBudget')(f.db.withPlugin(observer),{title:'My Site',tagline:'Form tagline',includeContent:true});
    expect(outcome.validation.valid).toBe(true);counts.push(queries);progress.push(outcome.seeded!.progress);complete=outcome.seeded!.complete;
    let total=0;for(const slug of slugs){const rows=await sql.raw(`SELECT COUNT(*) AS count FROM ec_${slug}`).execute(f.storage.database.db);total+=Number(Reflect.get(rows.rows[0] as object,'count'));}entries.push(total);
    if(complete)break;
   }
   expect(Math.max(...counts)).toBeLessThan(1000);expect(counts.length).toBeGreaterThan(1);expect(complete).toBe(true);
   expect(progress.slice(0,-1).every(p=>p.total===112)).toBe(true);expect(progress.slice(0,-1).map(p=>p.done)).toEqual(entries.slice(0,-1));
   expect(new Set(progress.slice(0,-1).map(p=>p.done)).size).toBe(progress.length-1);
   expect(entries.at(-1)).toBe(112);expect(await f.options.get('site:title')).toBe('My Site');expect(await f.options.get('site:tagline')).toBe('Form tagline');
   expect(await f.options.get('emdash:setup_state')).toBeNull();
  }finally{await f.storage.close();}
 },30000);
});
