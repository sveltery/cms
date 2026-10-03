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
