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
    assert.equal(recognizeVersionedFtsOwner({...owner,searchConfig:JSON.stringify({enabled:false})},objects)?.objects.length,9);
    assert.equal(recognizeVersionedFtsOwner({...owner,searchConfig:'malformed'},objects),null);
    assert.equal(recognizeVersionedFtsOwner({...owner,searchConfig:JSON.stringify({enabled:true,tokenize:'unknown'})},objects),null);
    assert.equal(recognizeVersionedFtsOwner({...owner,fields:owner.fields.slice(0,1)},objects),null);
    assert.equal(recognizeVersionedFtsOwner(owner,objects.slice(1)),null);
    assert.equal(recognizeVersionedFtsOwner(owner,[...objects,{...objects[0],name:'_cms_fts_notes_v3_extra'}]),null);
    const spoof=objects.map((object: {name:string;sql:string})=>object.name=== '_cms_fts_notes_v3'?{...object,sql:'CREATE TABLE "_cms_fts_notes_v3" (id TEXT)'}:object);
    assert.equal(recognizeVersionedFtsOwner(owner,spoof),null);
    const altered=objects.map((object:{name:string;sql:string})=>object.name.endsWith('_update')?{...object,sql:object.sql.replace('OLD.locale IS NOT NEW.locale','1 = 1')}:object);
    assert.equal(recognizeVersionedFtsOwner(owner,altered),null);
  });
}

