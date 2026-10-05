// Original requirements on genuine canonical Node/raw-D1/session-dialect storage.
// These are supplemental native owner/atomicity assertions, not copied Source credit.
import {beforeEach,describe,it,expect} from 'vitest';
import {Kysely,sql} from 'kysely';
import {openSqlite} from '../../src/lib/server/database/sqlite.ts';
import {openD1,SessionD1Dialect} from '../../src/lib/server/database/d1.ts';
import {migrateCms} from '../../src/lib/server/database/migrations.ts';
import {SchemaRegistry} from '../../src/lib/server/database/registry.ts';
import type {CmsDatabase,CmsTables} from '../../src/lib/server/database/contract.ts';
import {asyncD1Storage} from '../helpers/async-d1-storage.ts';
import {BylineRepository} from '../../src/lib/server/bylines/repository.ts';
import {BylineSchemaRegistry} from '../../src/lib/server/bylines/schema.ts';
import {resetBylineFieldDefsCacheForTests} from '../../src/lib/server/bylines/field-defs-cache.ts';
import {resolveBylineCredits} from '../../src/lib/server/bylines/credits.ts';
import {registerBylineDatabase} from '../../src/lib/server/bylines/storage.ts';

type Runtime='Node'|'raw D1'|'serialized D1 dialect';
async function fixture(runtime:Runtime) {
 if(runtime==='Node') {const database=openSqlite(':memory:');return {database,close:()=>database.close()};}
 const storage=await asyncD1Storage();
 if(runtime==='raw D1') {const database=openD1(storage.binding);return {database,async close(){await database.close();await storage.runtime.dispose();}};}
 const dialect=new SessionD1Dialect({database:storage.binding});
 const db=new Kysely<CmsTables>({dialect});const adapter=dialect.createAdapter();
 const database:CmsDatabase={db,atomicBatch:queries=>db.connection().execute(()=>adapter.executeAtomicBatch(queries)),close:()=>db.destroy()};
 return {database,async close(){await database.close();await storage.runtime.dispose();}};
}
beforeEach(()=>resetBylineFieldDefsCacheForTests());
for(const runtime of ['Node','raw D1','serialized D1 dialect'] as const) describe(runtime,()=>{
 it('persists translated profiles, canonical custom fields and strict locale credits',async()=>{
  const f=await fixture(runtime);
  try {
   await migrateCms(f.database);const schema=new BylineSchemaRegistry(f.database);const repo=new BylineRepository(f.database);
   let failure:unknown=null;let first:string|undefined;let translated:string|undefined;
   try {
    await schema.createField({slug:'job_title',label:'Job title',type:'string'});
    await schema.createField({slug:'website',label:'Website',type:'url',translatable:false});
    const en=await repo.create({slug:'writer',displayName:'Writer',locale:'en',customFields:{job_title:'Editor',website:'https://example.com'}});first=en.id;
    const fr=await repo.create({slug:'writer',displayName:'Auteur',locale:'fr',translationOf:en.id,customFields:{job_title:'Rédacteur'}});translated=fr.id;
   } catch(error){failure=error;}
   expect(failure,'canonical byline writes must be available').toBeNull();
   expect((await repo.findById(translated!))?.customFields).toEqual({job_title:'Rédacteur',website:'https://example.com'});
   const registry=new SchemaRegistry(f.database);await registry.createCollection({slug:'post',label:'Posts'});
   await sql`INSERT INTO ec_post(id,locale,translation_group) VALUES ('entry','fr','entry')`.execute(f.database.db);
   await repo.setContentBylines('post','entry',[{bylineId:first!}]);
   const credits=await resolveBylineCredits(registerBylineDatabase(f.database),'post',[{id:'entry',authorId:null,primaryBylineId:first!,locale:'fr'}]);
   expect(credits.get('entry')?.map(credit=>credit.byline.displayName)).toEqual(['Auteur']);
   expect((await repo.getContentBylines('post','entry',{locale:'de'}))).toEqual([]);
   expect((await sql<{id:string}>`SELECT id FROM _cms_bylines`.execute(f.database.db)).rows).toHaveLength(2);
   expect((await sql<{name:string}>`SELECT name FROM sqlite_master WHERE name LIKE '_emdash_%'`.execute(f.database.db)).rows).toEqual([]);
  }finally{await f.close();}
 },90000);
 it('rolls back a failing replacement of ordered credits including the primary pointer',async()=>{
  const f=await fixture(runtime);
  try{
   await migrateCms(f.database);const repo=new BylineRepository(f.database);
   const old=await repo.create({slug:'old',displayName:'Old'});const first=await repo.create({slug:'first',displayName:'First'});const second=await repo.create({slug:'second',displayName:'Second'});
   const registry=new SchemaRegistry(f.database);await registry.createCollection({slug:'post',label:'Posts'});
   await sql`INSERT INTO ec_post(id,locale,translation_group) VALUES ('entry','en','entry')`.execute(f.database.db);
   await repo.setContentBylines('post','entry',[{bylineId:old.id}]);
   await sql.raw("CREATE TRIGGER reject_second_credit BEFORE INSERT ON _cms_content_bylines WHEN NEW.sort_order=1 BEGIN SELECT RAISE(ABORT,'original-byline-rollback'); END").execute(f.database.db);
   await expect(repo.setContentBylines('post','entry',[{bylineId:first.id},{bylineId:second.id}])).rejects.toThrow('original-byline-rollback');
   const rows=(await sql<{byline_id:string;sort_order:number}>`SELECT byline_id,sort_order FROM _cms_content_bylines WHERE content_id='entry' ORDER BY sort_order`.execute(f.database.db)).rows;
   expect(rows).toEqual([{byline_id:old.translationGroup,sort_order:0}]);
   const pointer=(await sql<{primary_byline_id:string}>`SELECT primary_byline_id FROM ec_post WHERE id='entry'`.execute(f.database.db)).rows[0]?.primary_byline_id;
   expect(pointer).toBe(old.translationGroup);
  }finally{await f.close();}
 },90000);
 it('deletes translations while retaining sibling credits, then clears the last group and pointer',async()=>{
  const f=await fixture(runtime);
  try{
   await migrateCms(f.database);const repo=new BylineRepository(f.database);const schema=new BylineSchemaRegistry(f.database);
   await schema.createField({slug:'website',label:'Website',type:'url',translatable:false});
   const en=await repo.create({slug:'writer',displayName:'Writer',locale:'en',customFields:{website:'https://example.com'}});
   const fr=await repo.create({slug:'writer',displayName:'Auteur',locale:'fr',translationOf:en.id});
   const registry=new SchemaRegistry(f.database);await registry.createCollection({slug:'post',label:'Posts'});
   await sql`INSERT INTO ec_post(id,locale,translation_group) VALUES ('entry','fr','entry')`.execute(f.database.db);
   await repo.setContentBylines('post','entry',[{bylineId:en.id}]);
   let failure:unknown=null;try{await repo.delete(en.id);}catch(error){failure=error;}
   expect(failure,'canonical byline deletion must be available').toBeNull();
   expect((await repo.getContentBylines('post','entry',{locale:'fr'})).map(row=>row.byline.id)).toEqual([fr.id]);
   expect((await repo.findById(fr.id))?.customFields).toEqual({website:'https://example.com'});
   expect(await repo.delete(fr.id)).toBe(true);
   expect((await sql`SELECT id FROM _cms_content_bylines`.execute(f.database.db)).rows).toEqual([]);
   expect((await sql`SELECT field_id FROM _cms_byline_field_group_values`.execute(f.database.db)).rows).toEqual([]);
   expect((await sql<{primary_byline_id:string|null}>`SELECT primary_byline_id FROM ec_post WHERE id='entry'`.execute(f.database.db)).rows[0]?.primary_byline_id).toBeNull();
  }finally{await f.close();}
 },90000);
 it('rolls back copied credits if writing the target primary pointer fails',async()=>{
  const f=await fixture(runtime);
  try{
   await migrateCms(f.database);const repo=new BylineRepository(f.database);const profile=await repo.create({slug:'writer',displayName:'Writer'});
   const registry=new SchemaRegistry(f.database);await registry.createCollection({slug:'post',label:'Posts'});
   await sql`INSERT INTO ec_post(id,locale,translation_group) VALUES ('source','en','source'),('target','en','target')`.execute(f.database.db);
   await repo.setContentBylines('post','source',[{bylineId:profile.id}]);
   await sql`CREATE TRIGGER original_byline_copy_failure BEFORE UPDATE OF primary_byline_id ON ec_post WHEN NEW.id='target' BEGIN SELECT RAISE(ABORT,'original-copy-rollback'); END`.execute(f.database.db);
   await expect(repo.copyContentBylines('post','source','target')).rejects.toThrow('original-copy-rollback');
   expect((await sql`SELECT id FROM _cms_content_bylines WHERE content_id='target'`.execute(f.database.db)).rows).toEqual([]);
   expect((await sql<{primary_byline_id:string|null}>`SELECT primary_byline_id FROM ec_post WHERE id='target'`.execute(f.database.db)).rows[0]?.primary_byline_id).toBeNull();
  }finally{await f.close();}
 },90000);

 it('stages credit replacement inside the owning content batch without a separate commit',async()=>{
  const f=await fixture(runtime);
  try{
   await migrateCms(f.database);const repo=new BylineRepository(f.database);
   const old=await repo.create({slug:'old',displayName:'Old'});const next=await repo.create({slug:'next',displayName:'Next'});
   const registry=new SchemaRegistry(f.database);await registry.createCollection({slug:'post',label:'Posts'});
   await sql`INSERT INTO ec_post(id,locale,translation_group,status) VALUES ('entry','en','entry','draft')`.execute(f.database.db);
   await repo.setContentBylines('post','entry',[{bylineId:old.id}]);
   const producer=repo as BylineRepository&{planContentBylineReplacement?:Function};
   expect(typeof producer.planContentBylineReplacement,'actual staged byline producer').toBe('function');
   const plan=await producer.planContentBylineReplacement!('post','entry',[{bylineId:next.id,roleLabel:'Editor'}]);
   expect((await repo.getContentBylines('post','entry')).map(row=>row.byline.id)).toEqual([old.id]);
   await expect(f.database.atomicBatch([sql`UPDATE ec_post SET status='published' WHERE id='entry'`.compile(f.database.db),...plan,sql`INSERT INTO ec_post(original_missing_column) VALUES ('abort')`.compile(f.database.db)])).rejects.toThrow('original_missing_column');
   expect((await repo.getContentBylines('post','entry')).map(row=>row.byline.id)).toEqual([old.id]);
   expect((await sql<{status:string}>`SELECT status FROM ec_post WHERE id='entry'`.execute(f.database.db)).rows[0]?.status).toBe('draft');
   await f.database.atomicBatch([sql`UPDATE ec_post SET status='published' WHERE id='entry'`.compile(f.database.db),...plan]);
   expect((await repo.getContentBylines('post','entry')).map(row=>[row.byline.id,row.roleLabel])).toEqual([[next.id,'Editor']]);
   expect((await sql<{primary_byline_id:string}>`SELECT primary_byline_id FROM ec_post WHERE id='entry'`.execute(f.database.db)).rows[0]?.primary_byline_id).toBe(next.id);
  }finally{await f.close();}
 },90000);

});
