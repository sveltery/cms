import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {createHash} from 'node:crypto';
import { stripTypeScriptTypes } from 'node:module';
import { sql, type Kysely } from 'kysely';
import { schemaAdminStorage } from './helpers/schema-admin-storage.ts';
import type {CmsTables} from '../src/lib/server/database/contract.ts';

// Complete unchanged EmDash source modules at 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e.
// Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
// Host loader substitutes only import resolution and TypeScript erasure.
// These original paired physical-DDL probes establish bounded SQLite/D1 source
// behavior; they do not run the whole upstream migration runner or earn source
// test-declaration credit.
const sourceBlobs:Record<string,string>={
  'migrations/003_schema_registry.ts':'8772c9615e69720581e4d50a0a28f34147943dc9',
  'migrations/012_search.ts':'e543798005e0c44d7386f040937a6b41185df71e',
  'dialect-helpers.ts':'d2883911f5c0a158ddcdf72e3b35020c377a8c24',
  'validate.ts':'73d3b303764b473d4238e0cb17f1a904998671f8'
};
function moduleUrl(path:string, replacements:Record<string,string>={}) {
  const bytes=readFileSync(new URL('./fixtures/metadata-upgrade-source/'+path+'.txt',import.meta.url));
  assert.equal(createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex'),sourceBlobs[path],path);
  let source=stripTypeScriptTypes(bytes.toString('utf8'),{mode:'transform'});
  for(const [before,after] of Object.entries(replacements)) source=source.replaceAll(before,after);
  return 'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
}
const validate=moduleUrl('validate.ts');
const helper=moduleUrl('dialect-helpers.ts',{'"kysely"':JSON.stringify(import.meta.resolve('kysely')),'"./validate.js"':JSON.stringify(validate)});
const registry=await import(moduleUrl('migrations/003_schema_registry.ts',{'"../dialect-helpers.js"':JSON.stringify(helper)})) as {up(db:Kysely<CmsTables>):Promise<void>};
const search=await import(moduleUrl('migrations/012_search.ts')) as {up(db:Kysely<CmsTables>):Promise<void>};

for(const target of ['Node','D1'] as const) test(`${target}: exact source003/012 cascade fields and add nullable search configuration`,async()=>{
  const storage=await schemaAdminStorage(target); const db=storage.database.db;
  try {
    await registry.up(db); await search.up(db);
    const keys=(await sql<{table:string;from:string;to:string;on_delete:string}>`PRAGMA foreign_key_list(_emdash_fields)`.execute(db)).rows;
    assert.deepEqual(keys.map(({table,from,to,on_delete})=>({table,from,to,on_delete})),[{table:'_emdash_collections',from:'collection_id',to:'id',on_delete:'CASCADE'}]);
    const columns=(await sql<{name:string;type:string;notnull:number;dflt_value:string|null}>`PRAGMA table_info(_emdash_collections)`.execute(db)).rows;
    const column=columns.find(column=>column.name==='search_config'); assert.ok(column);
    assert.deepEqual({type:column.type,notnull:column.notnull,default:column.dflt_value},{type:'TEXT',notnull:0,default:null});
    await sql`INSERT INTO _emdash_collections(id,slug,label) VALUES ('collection','posts','Posts')`.execute(db);
    await sql`INSERT INTO _emdash_fields(id,collection_id,slug,label,type,column_type) VALUES ('field','collection','title','Title','string','TEXT')`.execute(db);
    assert.equal((await sql<{search_config:string|null}>`SELECT search_config FROM _emdash_collections`.execute(db)).rows[0].search_config,null);
    await sql`DELETE FROM _emdash_collections WHERE id='collection'`.execute(db);
    assert.deepEqual((await sql`SELECT * FROM _emdash_fields`.execute(db)).rows,[]);
  } finally {await storage.close();}
});
