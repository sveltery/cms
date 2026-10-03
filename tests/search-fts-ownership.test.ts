import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { recognizeVersionedFtsOwner, type FtsOwnerMetadata } from '../src/lib/server/search/fts-ownership.ts';
// Original guard tests; fixtures captured from the real source FTSManager after
// canonical provider 8 and real registered collection/fields, on Node and D1.
const owner: FtsOwnerMetadata = {id:'registered-id',slug:'notes_v3',searchConfig:JSON.stringify({enabled:true}),fields:[{slug:'title',type:'string',searchable:1},{slug:'body',type:'portableText',searchable:1}]};
for (const target of ['node','d1']) {
  test(`${target}: recognizes exactly the complete source-managed group`,async()=>{
    const objects=JSON.parse(await readFile(new URL(`./fixtures/search/${target}-notes-v3-ddl.json`,import.meta.url),'utf8'));
    const recognized=recognizeVersionedFtsOwner(owner,objects);
    assert.equal(recognized?.objects.length,9);
    assert.equal(recognized?.contentTable,'ec_notes_v3');
    assert.equal(recognizeVersionedFtsOwner({...owner,slug:'notes'},objects),null);
    assert.equal(recognizeVersionedFtsOwner({...owner,searchConfig:JSON.stringify({enabled:false})},objects),null);
    assert.equal(recognizeVersionedFtsOwner({...owner,fields:owner.fields.slice(0,1)},objects),null);
    assert.equal(recognizeVersionedFtsOwner(owner,objects.slice(1)),null);
    assert.equal(recognizeVersionedFtsOwner(owner,[...objects,{...objects[0],name:'_cms_fts_notes_v3_extra'}]),null);
    const spoof=objects.map((object: {name:string;sql:string})=>object.name=== '_cms_fts_notes_v3'?{...object,sql:'CREATE TABLE "_cms_fts_notes_v3" (id TEXT)'}:object);
    assert.equal(recognizeVersionedFtsOwner(owner,spoof),null);
    const altered=objects.map((object:{name:string;sql:string})=>object.name.endsWith('_update')?{...object,sql:object.sql.replace('OLD.locale IS NOT NEW.locale','1 = 1')}:object);
    assert.equal(recognizeVersionedFtsOwner(owner,altered),null);
  });
}

// The public pinned createFtsTable helper accepts explicit field order and may
// create a complete owned group before enableSearch writes search_config.
for (const target of ['Node','D1'] as const) {
  test(`${target}: real source createFtsTable owns reversed fields before config`,async()=>{
    const {schemaAdminStorage}=await import('./helpers/schema-admin-storage.ts');
    const {migrateCms}=await import('../src/lib/server/database/migrations.ts');
    const {SchemaRegistry}=await import('../src/lib/server/database/registry.ts');
    const {FTSManager}=await import('../src/lib/server/search/fts-manager.ts');
    const {sql}=await import('kysely');
    const storage=await schemaAdminStorage(target);
    try {
      await migrateCms(storage.database);
      const registry=new SchemaRegistry(storage.database);
      const collection=await registry.createCollection({slug:'notes_v3',label:'Notes',supports:[]});
      await registry.createField('notes_v3',{slug:'title',label:'Title',type:'string',searchable:true});
      await registry.createField('notes_v3',{slug:'body',label:'Body',type:'portableText',searchable:true});
      await new FTSManager(storage.database.db as unknown as import('kysely').Kysely<import('../src/lib/server/database/lifecycle/upstream/database/types.ts').Database>).createFtsTable('notes_v3',['body','title'],undefined,'unicode61');
      const metadata=await storage.database.db.selectFrom('_cms_collections').select('search_config').where('id','=',collection.id).executeTakeFirstOrThrow();
      assert.equal(metadata.search_config,null);
      const complete=(await sql<import('../src/lib/server/search/fts-ownership.ts').FtsCatalogueObject>`SELECT name,type,tbl_name,sql FROM sqlite_master WHERE substr(name,1,${'_cms_fts_notes_v3'.length}) = ${'_cms_fts_notes_v3'}`.execute(storage.database.db)).rows;
      assert.equal(complete.length,9);
      assert.equal(recognizeVersionedFtsOwner({...owner,id:collection.id,searchConfig:null},complete)?.objects.length,9);
    } finally {await storage.close();}
  });
}
