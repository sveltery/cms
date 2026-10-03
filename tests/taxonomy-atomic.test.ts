import test from 'node:test';
import assert from 'node:assert/strict';
import {sql} from 'kysely';
import {openSqlite} from '../src/lib/server/database/sqlite.ts';
import {migrateCms} from '../src/lib/server/database/migrations.ts';
import {SchemaRegistry} from '../src/lib/server/database/registry.ts';
import {DraftRepository} from '../src/lib/server/database/entries.ts';
import {NativeTaxonomyRepository as TaxonomyRepository} from '../src/lib/server/taxonomies/upstream/database/repositories/taxonomy-native.ts';
import {registerTaxonomyDatabase} from '../src/lib/server/taxonomies/upstream/host.ts';

test('failed assignment insertion rolls back removal of existing terms',async()=>{
 const database=openSqlite(':memory:');registerTaxonomyDatabase(database);try{
  await migrateCms(database);const registry=new SchemaRegistry(database);
  await registry.createCollection({slug:'posts',label:'Posts'});await registry.createField('posts',{slug:'title',label:'Title',type:'string'});
  const entry=await new DraftRepository(database).create({type:'posts',data:{title:'Atomic post'}},'author');
  const repo=new TaxonomyRepository(database.db as any),old=await repo.create({name:'tag',slug:'old',label:'Old'}),next=await repo.create({name:'tag',slug:'next',label:'Next'});
  await repo.setTermsForEntry('posts',entry.id,'tag',[old.id]);
  await sql`CREATE TRIGGER reject_new_term BEFORE INSERT ON content_taxonomies WHEN NEW.taxonomy_id=${sql.lit(next.translationGroup!)} BEGIN SELECT RAISE(ABORT,'assignment failure'); END`.execute(database.db);
  await assert.rejects(repo.setTermsForEntry('posts',entry.id,'tag',[next.id]),/assignment failure/);
  assert.deepEqual((await repo.getTermsForEntry('posts',entry.id,'tag')).map(term=>term.slug),['old']);
 }finally{await database.close();}
});

test('large native assignment sets respect the actual 100 parameter D1 statement budget',async()=>{
 const database=openSqlite(':memory:');registerTaxonomyDatabase(database);try{
  await migrateCms(database);const registry=new SchemaRegistry(database);await registry.createCollection({slug:'posts',label:'Posts'});await registry.createField('posts',{slug:'title',label:'Title',type:'string'});const entry=await new DraftRepository(database).create({type:'posts',data:{title:'Many terms'}},'author');
  const repo=new TaxonomyRepository(database.db as any),ids=[];for(let index=0;index<101;index++)ids.push((await repo.create({name:'tag',slug:`term-${index}`,label:`Term ${index}`})).id);
  const batch=database.atomicBatch.bind(database);database.atomicBatch=async queries=>{for(const query of queries)assert.ok(query.parameters.length<=100,'native assignment statement exceeds the actual D1 parameter budget');return batch(queries);};
  await repo.setTermsForEntry('posts',entry.id,'tag',ids);assert.equal((await repo.getTermsForEntry('posts',entry.id,'tag')).length,101);await repo.setTermsForEntry('posts',entry.id,'tag',[]);assert.deepEqual(await repo.getTermsForEntry('posts',entry.id,'tag'),[]);
 }finally{await database.close();}
});
