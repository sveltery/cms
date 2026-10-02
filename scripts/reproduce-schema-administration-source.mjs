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
const realImports=new Set(['kysely','ulidx','../database/transaction.js','./types.js','./url-pattern.js','../database/dialect-helpers.js','../database/validate.js']);
const sources=[];
try {
  await writeFile(join(directory,'package.json'),'{"type":"module"}');
  await symlink(join(root,'node_modules'),join(directory,'node_modules'),'dir');
  for (const path of ['schema/registry.ts','schema/types.ts','schema/url-pattern.ts','database/transaction.ts','database/dialect-helpers.ts','database/validate.ts']) {
    const source='packages/core/src/'+path;
    const raw=execFileSync('git',['show',pin+':'+source],{cwd:upstream,encoding:'utf8'});
    const blob=execFileSync('git',['rev-parse',pin+':'+source],{cwd:upstream,encoding:'utf8'}).trim();
    if (path==='schema/registry.ts') assert.equal(blob,'da7bbcdda224dfca8d9146b2f36659ab90bcac2e');
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
    FTSManager:'class { async dropFtsTable() {} }'};
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
    resolveId(source,importer){if(importer===registryPath&&fixtures.has(source))return '\0fixture:'+source;},
    load(id){if(id.startsWith('\0fixture:'))return fixtures.get(id.slice('\0fixture:'.length));}
  }],build:{target:'node24',minify:false,outDir:directory,emptyOutDir:false,lib:{entry:join(directory,'entry.ts'),formats:['es'],fileName:()=> 'bundle.mjs'},rollupOptions:{external:['node:test','node:assert/strict','node:sqlite','kysely','ulidx']}}});
  execFileSync(process.execPath,['--test',join(directory,'bundle.mjs')],{stdio:'inherit'});
  console.log(JSON.stringify({pin,sources,inactiveFixtures:['FTS drop','media activation and cleanup','registered-collection cache','development type generation'],declarations:0},null,2));
}finally{await rm(directory,{recursive:true,force:true});}
