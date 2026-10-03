// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// Original probes of the full immutable registry with inactive subsystem fixtures.
// No copied upstream declarations or FTS/media/type-generation credit.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtemp,mkdir,writeFile,readFile,symlink,rm} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import ts from 'typescript';
const pin='913cb1bb9b7f08c3ff0d258b4420e53835b6a58e';
const upstream=process.argv[2];
if (!upstream) throw new Error('Usage: node scripts/reproduce-schema-administration-source.mjs /path/to/emdash');
const root=fileURLToPath(new URL('../',import.meta.url));
const directory=await mkdtemp(join(tmpdir(),'cms-schema-admin-delete-source-'));
const registryPath=join(directory,'schema/registry.ts');
const handlerPath=join(directory,'api/handlers/schema.ts');
const realImports=new Set(['kysely','ulidx','../database/transaction.js','./types.js','./url-pattern.js','../database/dialect-helpers.js','../database/validate.js']);
const sources=[];
try {
  await writeFile(join(directory,'package.json'),'{"type":"module"}');
  await symlink(join(root,'node_modules'),join(directory,'node_modules'),'dir');
  for (const path of ['schema/registry.ts','schema/types.ts','schema/url-pattern.ts','database/transaction.ts','database/dialect-helpers.ts','database/validate.ts','api/handlers/schema.ts']) {
    const source='packages/core/src/'+path;
    const raw=execFileSync('git',['show',pin+':'+source],{cwd:upstream,encoding:'utf8'});
    const blob=execFileSync('git',['rev-parse',pin+':'+source],{cwd:upstream,encoding:'utf8'}).trim();
    if (path==='schema/registry.ts') assert.equal(blob,'da7bbcdda224dfca8d9146b2f36659ab90bcac2e');
    if (path==='api/handlers/schema.ts') assert.equal(blob,'abe31215af8f40b3df4ae4d1be5d06ebbe9342e0');
    const destination=join(directory,path); await mkdir(dirname(destination),{recursive:true}); await writeFile(destination,raw);
    sources.push({source,blob});
  }
  const raw=await readFile(registryPath,'utf8');
  const ast=ts.createSourceFile(registryPath,raw,ts.ScriptTarget.Latest,true);
  const fixtures=new Map();
  const overrides={refreshDevTypes:'() => {}',resetRegisteredCollectionsCache:'() => {}',
    finishMediaUsageCollectionDeletion:'async () => ({state:"complete"})',
    isMediaUsageCollectionSlugDeleting:'async () => false',
    prepareMediaUsageCollectionCapture:'async (_db,input) => ({collectionId:input.collectionId,captureRequired:false})',
    deleteActivatedMediaUsageCollection:'async () => "inactive"',
    deleteContentMediaUsageCollection:'async () => {}',
    FTSManager:'class { async dropFtsTable() {} }',
    invalidateContentMediaUsageSchemaChange:'async () => false',
    markContentMediaUsageCollectionStaleSafely:'async () => {}'};
  for (const statement of ast.statements) {
    if (!ts.isImportDeclaration(statement)||statement.importClause?.isTypeOnly) continue;
    const path=statement.moduleSpecifier.text; if(realImports.has(path)) continue;
    const names=(statement.importClause?.namedBindings?.elements??[]).filter(item=>!item.isTypeOnly).map(item=>item.propertyName?.text??item.name.text);
    fixtures.set(path,names.map(name=>overrides[name]?`export const ${name}=${overrides[name]};`:`export function ${name}(){throw new Error(${JSON.stringify('Unimplemented fixture subsystem: '+path+':'+name)});}`).join('\n'));
  }
  await writeFile(join(directory,'entry.ts'),`
import test from 'node:test'; import assert from 'node:assert/strict';
import {Kysely,SqliteDialect,sql} from 'kysely'; import {DatabaseSync} from 'node:sqlite';
import {SchemaRegistry} from './schema/registry.ts';
import {handleSchemaFieldUpdate} from './api/handlers/schema.ts';
function storage(){
 const sqlite=new DatabaseSync(':memory:'); sqlite.exec('PRAGMA foreign_keys=ON');
 const db=new Kysely({dialect:new SqliteDialect({database:{close:()=>sqlite.close(),prepare(query){const statement=sqlite.prepare(query);return {reader:statement.columns().length>0,all:parameters=>statement.all(...parameters),run:parameters=>statement.run(...parameters)};}}})});
 return db;
}
async function fixture(db){
 await sql\`CREATE TABLE revisions(id TEXT PRIMARY KEY)\`.execute(db);
 await sql\`CREATE TABLE _emdash_collections(id TEXT PRIMARY KEY,slug TEXT UNIQUE,label TEXT,label_singular TEXT,description TEXT,supports TEXT,source TEXT,created_at TEXT DEFAULT '2000-01-01T00:00:00.000Z',updated_at TEXT DEFAULT '2000-01-01T00:00:00.000Z',icon TEXT,admin_config TEXT,has_seo INTEGER,title_field TEXT,date_field TEXT,url_pattern TEXT,routable INTEGER,hidden INTEGER,sort_order INTEGER,nav_group TEXT,comments_enabled INTEGER,comments_moderation TEXT,comments_closed_after_days INTEGER,comments_auto_approve_users INTEGER,edit_locking INTEGER)\`.execute(db);
 await sql\`CREATE TABLE _emdash_fields(id TEXT PRIMARY KEY,collection_id TEXT REFERENCES _emdash_collections(id) ON DELETE CASCADE,slug TEXT,label TEXT,type TEXT,column_type TEXT,required INTEGER,\"unique\" INTEGER,default_value TEXT,validation TEXT,widget TEXT,options TEXT,sort_order INTEGER,searchable INTEGER,indexed INTEGER,translatable INTEGER,created_at TEXT DEFAULT '2000-01-01T00:00:00.000Z',UNIQUE(collection_id,slug))\`.execute(db);
}
test('immutable complete blocks normalization rejects disallowed descriptor settings before create and update writes',async()=>{
 const db=storage();try{
 await fixture(db);const registry=new SchemaRegistry(db);await registry.createCollection({slug:'posts',label:'Posts'});
 const valid=await registry.createField('posts',{slug:'body',label:'Body',type:'blocks',required:false,unique:false,indexed:false,searchable:false,defaultValue:[]});
 assert.deepEqual(valid.defaultValue,[]);
 assert.deepEqual(valid.validation,{allowedTypes:[],retiredTypes:[],minItems:0,maxItems:100});
 const settings=[{required:true},{unique:true},{indexed:true},{searchable:true},{widget:''},{options:{}},{defaultValue:2},{defaultValue:null},{defaultValue:[{}]},{defaultValue:{}}];
 for(let index=0;index<settings.length;index++){
  const input=settings[index];const code=input.indexed?'FIELD_NOT_INDEXABLE':'VALIDATION_ERROR';
  const before=await db.selectFrom('_emdash_collections').selectAll().execute();
  const fields=await db.selectFrom('_emdash_fields').selectAll().execute();
  const ddl=(await sql\`SELECT name,sql FROM sqlite_master ORDER BY name\`.execute(db)).rows;
  await assert.rejects(()=>registry.createField('posts',{slug:'invalid_'+index,label:'Invalid',type:'blocks',...input}),error=>error.code===code);
  await assert.rejects(()=>registry.updateField('posts','body',input),error=>error.code===code);
  assert.deepEqual(await db.selectFrom('_emdash_collections').selectAll().execute(),before);
  assert.deepEqual(await db.selectFrom('_emdash_fields').selectAll().execute(),fields);
  assert.deepEqual((await sql\`SELECT name,sql FROM sqlite_master ORDER BY name\`.execute(db)).rows,ddl);
 }
 await registry.updateField('posts','body',{required:false,unique:false,indexed:false,searchable:false,defaultValue:[]});
 assert.deepEqual((await registry.getField('posts','body')).defaultValue,[]);
 }finally{await db.destroy();}
});
test('immutable source rejects raw unsupported title aliases despite its string fallback projection',async()=>{
 const db=storage();try{
 await fixture(db);const registry=new SchemaRegistry(db);const collection=await registry.createCollection({slug:'posts',label:'Posts'});
 await db.insertInto('_emdash_fields').values({id:'future',collection_id:collection.id,slug:'future',label:'Future',type:'future_field_type',column_type:'TEXT',required:0,unique:0,sort_order:0,searchable:0,indexed:0,translatable:1}).execute();
 const projected=await registry.getField('posts','future');
 assert.equal(projected.type,'string');assert.equal(projected.unsupportedType.type,'future_field_type');
 await assert.rejects(()=>registry.updateCollection('posts',{titleField:'future'}),error=>error.code==='INVALID_TITLE_FIELD');
 assert.equal((await registry.getCollection('posts')).titleField,undefined);
 }finally{await db.destroy();}
});
test('immutable source reorderFields accepts partial duplicate and unknown lists without advancing collection metadata',async()=>{
 const db=storage();try{
 await fixture(db);const registry=new SchemaRegistry(db);await registry.createCollection({slug:'posts',label:'Posts'});
 const before=await registry.getCollection('posts');
 await db.insertInto('_emdash_fields').values(['one','two'].map((slug,index)=>({id:slug,collection_id:before.id,slug,label:slug,type:'string',column_type:'TEXT',required:0,unique:0,sort_order:index,searchable:0,indexed:0,translatable:1}))).execute();
 for(const [order,sorts] of [[['two'],[0,0]],[['one','one'],[1,0]],[['missing'],[1,0]]]) {
   await registry.reorderFields('posts',order);
   assert.deepEqual(await registry.getCollection('posts'),before);
   const fields=await registry.listFields(before.id);
   assert.deepEqual(['one','two'].map(slug=>fields.find(field=>field.slug===slug).sortOrder),sorts);
 }
 }finally{await db.destroy();}
});
test('immutable Node field deletion checks column existence inside its transaction after a preflight deletion race',async()=>{
 const db=storage();try{
 await fixture(db);const registry=new SchemaRegistry(db);await registry.createCollection({slug:'posts',label:'Posts'});
 await registry.createField('posts',{slug:'candidate',label:'Candidate',type:'string',searchable:false});
 const before=await registry.getCollection('posts');
 const transaction=db.transaction.bind(db);let raced=false;let committed;
 db.transaction=()=>{
  const builder=transaction();const execute=builder.execute.bind(builder);
  builder.execute=async callback=>{
   db.transaction=transaction;raced=true;
   await registry.deleteField('posts','candidate');
   assert.equal((await registry.getCollection('posts')).updatedAt,before.updatedAt);
   committed={fields:await db.selectFrom('_emdash_fields').selectAll().execute(),collections:await db.selectFrom('_emdash_collections').selectAll().execute(),ddl:(await sql\`SELECT name,sql FROM sqlite_master ORDER BY name\`.execute(db)).rows};
   return execute(callback);
  };return builder;
 };
 await registry.deleteField('posts','candidate');
 assert.equal(raced,true);assert.equal(await registry.getField('posts','candidate'),null);
 assert.deepEqual({fields:await db.selectFrom('_emdash_fields').selectAll().execute(),collections:await db.selectFrom('_emdash_collections').selectAll().execute(),ddl:(await sql\`SELECT name,sql FROM sqlite_master ORDER BY name\`.execute(db)).rows},committed);
 await assert.rejects(()=>registry.deleteField('posts','candidate'),error=>error.code==='FIELD_NOT_FOUND');
 }finally{await db.destroy();}
});
test('immutable source rejects an indexed relation-bound reference before DDL or metadata writes',async()=>{
 const db=storage();try{
 await fixture(db);const registry=new SchemaRegistry(db);await registry.createCollection({slug:'posts',label:'Posts'});
 const before=await db.selectFrom('_emdash_collections').selectAll().execute();
 const ddl=(await sql\`SELECT name,sql FROM sqlite_master ORDER BY name\`.execute(db)).rows;
 await assert.rejects(()=>registry.createField('posts',{slug:'parent_ref',label:'Parent',type:'reference',indexed:true,
   validation:{relation:'post_links',relationSide:'child',targetCollection:'posts'}}),error=>error.code==='FIELD_NOT_INDEXABLE');
 assert.deepEqual(await db.selectFrom('_emdash_collections').selectAll().execute(),before);
 assert.deepEqual(await db.selectFrom('_emdash_fields').selectAll().execute(),[]);
 assert.deepEqual((await sql\`SELECT name,sql FROM sqlite_master ORDER BY name\`.execute(db)).rows,ddl);
 }finally{await db.destroy();}
});
test('immutable source also rejects enabling a bound reference index or binding an indexed reference',async()=>{
 const db=storage();try{
 await fixture(db);const registry=new SchemaRegistry(db);const collection=await registry.createCollection({slug:'posts',label:'Posts'});
 const bound={relation:'post_links',relationSide:'child',targetCollection:'posts'};
 await db.insertInto('_emdash_fields').values([
  {id:'bound',collection_id:collection.id,slug:'bound',label:'Bound',type:'reference',column_type:'TEXT',required:0,unique:0,sort_order:0,indexed:0,validation:JSON.stringify(bound)},
  {id:'unbound',collection_id:collection.id,slug:'unbound',label:'Unbound',type:'reference',column_type:'TEXT',required:0,unique:0,sort_order:1,indexed:1,validation:null}
 ]).execute();
 const before=await db.selectFrom('_emdash_fields').selectAll().orderBy('id').execute();
 for(const [slug,input] of [['bound',{indexed:true}],['unbound',{validation:bound}]]) {
  await assert.rejects(()=>registry.updateField('posts',slug,input),error=>error.code==='FIELD_NOT_INDEXABLE');
  assert.deepEqual(await db.selectFrom('_emdash_fields').selectAll().orderBy('id').execute(),before);
 }
 }finally{await db.destroy();}
});

for(const replacement of [null,{multiple:false}]) test('complete immutable schema handler preserves bound identity for '+JSON.stringify(replacement),async()=>{
 const db=storage();try{
 await fixture(db);const registry=new SchemaRegistry(db);const collection=await registry.createCollection({slug:'posts',label:'Posts'});
 const binding={relation:'post_links',relationSide:'child',targetCollection:'posts'};
 await db.insertInto('_emdash_fields').values({id:'bound',collection_id:collection.id,slug:'bound',label:'Bound',type:'reference',column_type:'TEXT',required:0,unique:0,sort_order:0,indexed:0,validation:JSON.stringify({...binding,multiple:true})}).execute();
 const result=await handleSchemaFieldUpdate(db,'posts','bound',{validation:replacement});
 assert.equal(result.success,true,JSON.stringify(result));
 assert.deepEqual(result.data.item.validation,{...(replacement??{}),...binding});
 assert.deepEqual((await registry.getField('posts','bound')).validation,{...(replacement??{}),...binding});
 const before=await db.selectFrom('_emdash_fields').selectAll().execute();
 const rejected=await handleSchemaFieldUpdate(db,'posts','bound',{validation:{targetCollection:'other'}});
 assert.equal(rejected.success,false);assert.equal(rejected.error.code,'VALIDATION_ERROR');
 assert.deepEqual(await db.selectFrom('_emdash_fields').selectAll().execute(),before);
 await registry.updateField('posts','bound',{validation:null});
 assert.equal((await registry.getField('posts','bound')).validation,undefined,'source projection represents cleared validation as undefined');
 assert.equal((await db.selectFrom('_emdash_fields').select('validation').where('id','=','bound').executeTakeFirst()).validation,null,'generic registry retains SQL null replacement; protected merge belongs to the API handler');
 }finally{await db.destroy();}
});

for (const action of ['CASCADE','RESTRICT']) test('immutable Node registry force delete preserves external FK '+action,async()=>{
 const db=storage();try{
 await fixture(db);const registry=new SchemaRegistry(db);await registry.createCollection({slug:'posts',label:'Posts'});
 await sql\`INSERT INTO ec_posts(id) VALUES ('entry')\`.execute(db);
 await sql.raw('CREATE TABLE operator_links(id TEXT PRIMARY KEY,entry_id TEXT REFERENCES ec_posts(id) ON DELETE '+action+')').execute(db);
 await sql\`INSERT INTO operator_links VALUES ('link','entry')\`.execute(db);
 if(action==='CASCADE'){
   await registry.deleteCollection('posts',{force:true});
   assert.equal((await sql\`SELECT * FROM operator_links\`.execute(db)).rows.length,0);
   assert.equal(await registry.getCollection('posts'),null);
 }else{
   await assert.rejects(()=>registry.deleteCollection('posts',{force:true}),/FOREIGN KEY constraint failed/);
   assert.equal((await sql\`SELECT * FROM operator_links\`.execute(db)).rows.length,1);
   assert.equal((await sql\`SELECT * FROM ec_posts\`.execute(db)).rows.length,1);
   assert.ok(await registry.getCollection('posts'));
 }
 }finally{await db.destroy();}
});
`);
  await build({configFile:false,logLevel:'error',plugins:[{name:'inactive-subsystem-fixture',
    resolveId(source,importer){
      if(importer===handlerPath) {
        if(source==='../../database/transaction.js')return join(directory,'database/transaction.ts');
        if(source==='../../schema/index.js')return '\0handler-schema-bridge';
        return '\0handler-inactive:'+source;
      }
      if(importer===registryPath&&fixtures.has(source))return '\0fixture:'+source;
    },
    load(id){
      if(id==='\0handler-schema-bridge')return `export {SchemaRegistry,SchemaError} from ${JSON.stringify(registryPath)};export function invalidateSchemaCache(){};export function expandCollectionBlockFields(){throw new Error('inactive block expansion');}`;
      if(id.startsWith('\0handler-inactive:')) {
        const path=id.slice('\0handler-inactive:'.length);
        if(path==='../../object-cache/index.js')return 'export function invalidateCollectionCache(){};export function invalidateSchemaObjectCache(){};';
        if(path==='../../database/repositories/relation.js')return `export class RelationRepository{constructor(){throw new Error('inactive relation repository');}}`;
        if(path==='../../database/reference-backfill.js')return `export function backfillReferenceEdges(){throw new Error('inactive edge backfill');}`;
        if(path==='./relations.js')return `export function fieldsBoundToRelation(){throw new Error('inactive relation lifecycle');};export function handleRelationDelete(){throw new Error('inactive relation lifecycle');}`;
        throw new Error('Unexpected handler runtime fixture '+path);
      }
      if(id.startsWith('\0fixture:'))return fixtures.get(id.slice('\0fixture:'.length));
    }
  }],build:{target:'node24',minify:false,outDir:directory,emptyOutDir:false,lib:{entry:join(directory,'entry.ts'),formats:['es'],fileName:()=> 'bundle.mjs'},rollupOptions:{external:['node:test','node:assert/strict','node:sqlite','kysely','ulidx']}}});
  execFileSync(process.execPath,['--test',join(directory,'bundle.mjs')],{stdio:'inherit'});
  console.log(JSON.stringify({pin,sources,inactiveFixtures:['FTS drop','media activation and cleanup','registered-collection/object caches','development type generation','relation repository/lifecycle','reference edge backfill','block expansion'],declarations:0},null,2));
}finally{await rm(directory,{recursive:true,force:true});}
