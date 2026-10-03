import assert from 'node:assert/strict';
import test from 'node:test';
import {sql} from 'kysely';
import {Miniflare} from 'miniflare';
import {openSqlite} from '../src/lib/server/database/sqlite.ts';
import {openD1} from '../src/lib/server/database/d1.ts';
import {migrateCms} from '../src/lib/server/database/migrations.ts';
import {SchemaRegistry} from '../src/lib/server/database/registry.ts';

// Original native feature regressions, committed before implementation. These
// assertions supplement the separately copied complete pinned declarations.
for(const dialect of ['sqlite','d1']) {
  async function fixture() {
    const worker=dialect==='d1'?new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:{DB:'blocks-native-first'}}):undefined;
    const database=worker?openD1(await worker.getD1Database('DB')):openSqlite(':memory:');
    await migrateCms(database);
    const registry=new SchemaRegistry(database);
    await registry.createCollection({slug:'pages',label:'Pages'});
    return {database,registry,async close(){await database.close();await worker?.dispose();}};
  }
  test(`${dialect}: block fields reject unavailable reusable types before schema writes`,async()=>{
    const f=await fixture();try {
      await assert.rejects(f.registry.createField('pages',{slug:'layout',label:'Layout',type:'blocks',validation:{allowedTypes:['missing']}}),{code:'BLOCK_TYPE_NOT_FOUND'});
      assert.equal(await f.registry.getField('pages','layout'),null);
    }finally{await f.close();}
  });
  test(`${dialect}: block field metadata contains the pinned empty and limit defaults`,async()=>{
    const f=await fixture();try {
      const field=await f.registry.createField('pages',{slug:'layout',label:'Layout',type:'blocks'});
      assert.deepEqual(field.validation,{allowedTypes:[],retiredTypes:[],minItems:0,maxItems:100});
      assert.deepEqual(field.defaultValue,[]);
    }finally{await f.close();}
  });
  test(`${dialect}: blocks reject values above the source maximum before schema writes`,async()=>{
    const f=await fixture();try {
      await assert.rejects(f.registry.createField('pages',{slug:'layout',label:'Layout',type:'blocks',validation:{maxItems:101}}),{code:'VALIDATION_ERROR'});
      assert.equal(await f.registry.getField('pages','layout'),null);
    }finally{await f.close();}
  });
  test(`${dialect}: a positive block minimum requires migration on populated content`,async()=>{
    const f=await fixture();try {
      await sql`INSERT INTO ec_pages(id,slug,status) VALUES('existing','existing','draft')`.execute(f.database.db);
      await assert.rejects(f.registry.createField('pages',{slug:'layout',label:'Layout',type:'blocks',validation:{minItems:1}}),{code:'FIELD_UPDATE_REQUIRES_MIGRATION'});
      assert.equal(await f.registry.getField('pages','layout'),null);
    }finally{await f.close();}
  });
}
