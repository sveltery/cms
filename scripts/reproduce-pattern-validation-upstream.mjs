// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// Runs the complete immutable upstream registry and content validator against
// 32 original supplemental pattern probes per runtime, plus the unchanged
// MCP schema.test.ts:964 callback at an adapted request-schema/registry boundary.
// See docs/pattern-validation.md for fixture boundaries, source identities and evidence.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import ts from 'typescript';

const root = fileURLToPath(new URL('../', import.meta.url));
const pin = '913cb1bb9b7f08c3ff0d258b4420e53835b6a58e';
const directory = await mkdtemp(join(tmpdir(), 'cms-upstream-pattern-'));
const sources = [
  ['LICENSE', '02cc4b8b0a5f883c5243927e683b00c10588bf4c'],
  ['packages/core/src/api/schemas/schema.ts', '57e0338b8e1a7633d1e3409f4a38b39f73469e68'],
  ['packages/core/src/api/schemas/common.ts', 'ba9be767aa9a2c564f3ebfd2c4106ad904324c59'],
  ['packages/core/src/i18n/config.ts', 'fe714e5ad514485fe1737585c663e470d50519df'],
  ['packages/core/tests/integration/mcp/schema.test.ts', '4c1d5c283a19f4262b84cc5165b70f2046ba8b43'],
  ['packages/core/src/schema/registry.ts', 'da7bbcdda224dfca8d9146b2f36659ab90bcac2e'],
  ['packages/core/tests/unit/schema/registry.test.ts', '7e1413acd99071e888693021224a9644efa2a8c5'],
  ['packages/core/src/database/transaction.ts', '69bf167998a2fa9cc228c3612a69c8fde5ed85fe'],
  ['packages/cloudflare/src/db/d1-dialect.ts', 'b026d293554c5173e1447b5eff0d704e169d3384']
];
sources.push(
  ['packages/core/src/api/handlers/validation.ts', 'a9e40d310098e2329e166614fa10fcea1b53c84d'],
  ['packages/core/src/schema/zod-generator.ts', '550d4918258aa52a0d0f272b69061c76e79d86ee'],
  ['packages/core/src/utils/hash.ts', '93db9df4a2b88692d5772fa5e32d309d7f23fab8'],
  ['packages/core/src/utils/url.ts', '5ea627417b29212beeb178863f7b2f4989f90d58'],
  ['packages/core/src/utils/chunks.ts', '9ff9f0f4082b9f32e5c9f851a0a30cef1459048e'],
  ['packages/core/src/schema/types.ts', '0c2f44156cff829951c52b0dd259fc5ff45bc554'],
  ['packages/core/src/schema/url-pattern.ts', '1b9776eb0ab18119c46bceeeff2459db555bc41e'],
  ['packages/core/src/database/dialect-helpers.ts', 'd2883911f5c0a158ddcdf72e3b35020c377a8c24'],
  ['packages/core/src/database/validate.ts', '73d3b303764b473d4238e0cb17f1a904998671f8'],
  ['packages/cloudflare/src/db/d1-introspector.ts', '4c40fc55aa449f46f887f9335d11b42633312225'],
  ['packages/core/src/database/migration-lock.ts', '160cce48c64a6c815ec780bef8fc2646be5b5ec9'],
  ['packages/core/src/database/pg-migration-lock.ts', 'cf8fd580c4549e50e1d6ef0a0cb8515579bb6bc3'],
  ['packages/core/src/utils/db-errors.ts', 'd0a051ad9d48003eeeeb38dd9d5cb7cedf4140e5']
);

try {
  for (const [path, blob] of sources) {
    const destination = join(directory, path); await mkdir(dirname(destination), { recursive: true });
    execFileSync('curl', ['--retry', '2', '-fsSL', `https://raw.githubusercontent.com/emdash-cms/emdash/${pin}/${path}`, '-o', destination]);
    if (blob) {
      const content = await readFile(destination);
      const actual = createHash('sha1').update(`blob ${content.length}\0`).update(content).digest('hex');
      if (actual !== blob) throw new Error(`upstream blob mismatch: ${path}: ${actual}`);
    }
  }
  const selectedTestPath = join(directory, 'packages/core/tests/integration/mcp/schema.test.ts');
  const selectedAst = ts.createSourceFile(selectedTestPath, await readFile(selectedTestPath, 'utf8'), ts.ScriptTarget.Latest, true);
  let selectedCallback;
  function visitSelected(node) {
    if (ts.isCallExpression(node) && node.arguments[0]?.text === 'rejects invalid validation rules without changing the field') {
      if (selectedAst.getLineAndCharacterOfPosition(node.getStart(selectedAst)).line + 1 !== 964) throw new Error('selected source ID changed');
      selectedCallback = node.arguments[1].getText(selectedAst);
    }
    ts.forEachChild(node, visitSelected);
  }
  visitSelected(selectedAst);
  if (!selectedCallback || (selectedCallback.match(/expect\(/g) ?? []).length !== 3) throw new Error('selected source assertions changed');
  execFileSync('npm', ['pack', 'kysely-d1@0.4.0', '--cache', join(directory, 'npm-cache'), '--pack-destination', directory], { stdio: 'pipe' });
  if (createHash('sha1').update(await readFile(join(directory, 'kysely-d1-0.4.0.tgz'))).digest('hex') !== '3122753e3d3d1d00d118ff756a329ae2318b1589') throw new Error('kysely-d1 tarball mismatch');
  execFileSync('tar', ['-xzf', join(directory, 'kysely-d1-0.4.0.tgz'), '-C', directory]);
  await symlink(join(root, 'node_modules'), join(directory, 'node_modules'));
  execFileSync('npm', ['install', '--prefix', join(directory, 'zod'), '--cache', join(directory, 'npm-cache'), '--ignore-scripts', '--no-audit', '--no-fund', 'zod@4.5.4'], {stdio:'pipe'});
  const registryPath = join(directory, 'packages/core/src/schema/registry.ts');
  const registrySource = await readFile(registryPath, 'utf8');
  const ast = ts.createSourceFile(registryPath, registrySource, ts.ScriptTarget.Latest, true);
  const realImports = new Set(['kysely', 'ulidx', '../database/transaction.js', './types.js', './url-pattern.js', '../database/dialect-helpers.js', '../database/validate.js', '../utils/chunks.js']);
  const fixtureModules = new Map();
  for (const statement of ast.statements) {
    if (!ts.isImportDeclaration(statement) || statement.importClause?.isTypeOnly) continue;
    const path = statement.moduleSpecifier.text;
    if (realImports.has(path)) continue;
    const elements = statement.importClause?.namedBindings?.elements ?? [];
    const names = elements.filter(element => !element.isTypeOnly).map(element => element.propertyName?.text ?? element.name.text);
    if (!names.length) continue;
    const overrides = {
      refreshDevTypes: '() => {}', resetRegisteredCollectionsCache: '() => {}',
      finishMediaUsageCollectionDeletion: 'async () => ({ state: "complete" })',
      isMediaUsageCollectionSlugDeleting: 'async () => false',
      canResumeMediaUsageCollectionCapture: 'async () => false',
      findResumableMediaUsageCollectionCaptureId: 'async () => null',
      prepareMediaUsageCollectionCapture: 'async (_db, input) => ({ collectionId: input.collectionId, captureRequired: false })',
      invalidateContentMediaUsageSchemaChange: 'async () => false',
      markContentMediaUsageCollectionStaleSafely: 'async () => {}'
    };
    fixtureModules.set(path, names.map(name => overrides[name]
      ? `export const ${name} = ${overrides[name]};`
      : `export function ${name}() { throw new Error(${JSON.stringify(`outside schema-admin fixture: ${path}:${name}`)}); }`).join('\n'));
  }
  await writeFile(join(directory, 'fixture.ts'), `
import { Kysely, SqliteDialect, sql } from 'kysely'; import { DatabaseSync } from 'node:sqlite';
import { Miniflare } from 'miniflare';
import { RawBindingD1Dialect } from './packages/cloudflare/src/db/d1-dialect.ts';
export async function schemaAdminStorage(target, directory) {
  let runtime; let native;
  if (target === 'D1') runtime = new Miniflare({modules:true,script:'export default {fetch(){return new Response("fixture")}}',
    compatibilityDate:'2026-05-07',host:'127.0.0.1',port:0,cf:false,d1Databases:{DB:'upstream-schema-admin'}, d1Persist:directory ?? false});
  else native = new DatabaseSync(directory ? directory + '/schema.sqlite' : ':memory:');
  const db = new Kysely({dialect: runtime ? new RawBindingD1Dialect({database:await runtime.getD1Database('DB')})
    : new SqliteDialect({database:{close:()=>native.close(), prepare(query) {
      const statement=native.prepare(query);
      return {reader:statement.columns().length>0,all:parameters=>statement.all(...parameters),run:parameters=>statement.run(...parameters)};
    }}})});
  return {database:{db}, async close(){await db.destroy();await runtime?.dispose();}};
}
export async function migrateCms(database) {
  const {db}=database;
  await sql\`CREATE TABLE revisions (id TEXT PRIMARY KEY)\`.execute(db);
  await sql\`CREATE TABLE _emdash_collections (
    id TEXT PRIMARY KEY, slug TEXT UNIQUE, label TEXT, label_singular TEXT, description TEXT,
    supports TEXT, source TEXT, created_at TEXT DEFAULT '2000-01-01T00:00:00.000Z',
    updated_at TEXT DEFAULT '2000-01-01T00:00:00.000Z', icon TEXT, admin_config TEXT,
    has_seo INTEGER, title_field TEXT, date_field TEXT, url_pattern TEXT, routable INTEGER,
    hidden INTEGER, sort_order INTEGER, nav_group TEXT, comments_enabled INTEGER,
    comments_moderation TEXT, comments_closed_after_days INTEGER, comments_auto_approve_users INTEGER, edit_locking INTEGER
  )\`.execute(db);
  await sql\`CREATE TABLE _emdash_fields (
    id TEXT PRIMARY KEY, collection_id TEXT, slug TEXT, label TEXT, type TEXT, column_type TEXT,
    required INTEGER, "unique" INTEGER, default_value TEXT, validation TEXT, widget TEXT,
    options TEXT, sort_order INTEGER, searchable INTEGER, indexed INTEGER, translatable INTEGER,
    created_at TEXT DEFAULT '2000-01-01T00:00:00.000Z', UNIQUE(collection_id,slug)
  )\`.execute(db);
}
`);
  // Preserve all three source expressions and four input datasets unchanged.
  // The fixture replaces MCP client/envelope transport with a direct execution
  // of the complete upstream request schema and registry; it earns no MCP credit.
  const entryPath = join(directory, 'entry.ts');
  await writeFile(entryPath, await readFile(entryPath, 'utf8') + `
test(target+': adapted MCP schema.test.ts:964 exact source assertion callback',()=>fixture(async(db,r)=>{
 await r.createCollection({slug:'post',label:'Post'});
 await r.createField('post',{slug:'body',label:'Body',type:'text'});
 const before=await db.selectFrom('_emdash_fields').selectAll().orderBy('id').execute();
 const harness={client:{async callTool({name,arguments:input}) {
  assert.equal(name,'schema_update_field');
  const parsed=updateFieldBody.safeParse({validation:input.validation});
  if(!parsed.success) return {isError:true,content:[{type:'text',text:parsed.error.message}]};
  const item=await r.updateField(input.collection,input.fieldSlug,parsed.data);
  return {isError:false,content:[{type:'text',text:JSON.stringify({item})}]};
 }}};
 const extractText=result=>result.content.filter(item=>item.type==='text').map(item=>item.text).join('\\n');
 const expect=value=>({toBe:expected=>assert.equal(value,expected),
  toMatch:expected=>assert.match(value,expected),toBeUndefined:()=>assert.equal(value,undefined)});
 await (${selectedCallback})();
 assert.deepEqual(await db.selectFrom('_emdash_fields').selectAll().orderBy('id').execute(),before);
}));
`);

  await writeFile(join(directory, 'entry.ts'), String.raw`
import test from 'node:test'; import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises'; import {tmpdir} from 'node:os'; import {join} from 'node:path';
import {sql} from 'kysely';
import {SchemaRegistry} from './packages/core/src/schema/registry.ts';
import {createFieldBody,updateFieldBody} from './packages/core/src/api/schemas/schema.ts';
import {validateContentData} from './packages/core/src/api/handlers/validation.ts';
import {migrateCms,schemaAdminStorage} from './fixture.ts';
const target=process.env.CMS_UPSTREAM_TARGET;
const creation={slug:'value',label:'Value',type:'string'};
const bodies=[data=>createFieldBody.safeParse({...creation,...data}),data=>updateFieldBody.safeParse(data)];
const probe=(id,title,run)=>test(target+': '+id+' supplemental '+title,run);
async function fixture(run,directory,fieldOptions={}) {
 const h=await schemaAdminStorage(target,directory);
 try {await migrateCms(h.database);const db=h.database.db;const r=new SchemaRegistry(db);
  await r.createCollection({slug:'posts',label:'Posts'});
  for(const type of ['string','text']) await r.createField('posts',{slug:type,label:type,type,...fieldOptions});
  await run(db,r);
 } finally {await h.close();}
}
const validationCell=async(db,slug)=>(await db.selectFrom('_emdash_fields').select('validation').where('slug','=',slug).executeTakeFirst()).validation;
async function state(db) {return {
 schema:(await sql.raw("SELECT name,type,sql FROM sqlite_schema WHERE type IN ('table','index') ORDER BY name").execute(db)).rows.map(row=>({...row})),
 collection:await db.selectFrom('_emdash_collections').selectAll().execute(),
 content:await db.selectFrom('ec_posts').selectAll().orderBy('id').execute()
};}
async function withPatterns(pattern,run,extra={}) {await fixture(async(db,r)=>{
 for(const slug of ['string','text']) await r.updateField('posts',slug,{validation:{pattern}});
 await run(db,r);
},undefined,extra);}
const check=(db,data,partial=false)=>validateContentData(db,'posts',data,{partial});
const successful=async(db,data,partial=false)=>assert.deepEqual(await check(db,data,partial),{ok:true});

probe('P01','create/update preserve valid regex sources without trimming, flags or length limit',()=>{
 for(const pattern of ['', ' ', '.', '^a+$', '/a/i', '(?<word>a)', 'é', 'a'.repeat(100001)]) for(const body of bodies) {
  const result=body({validation:{pattern}}); assert.equal(result.success,true);
  assert.deepEqual(result.data.validation,{pattern});
 }
});
probe('P02','create/update reject invalid syntax with the exact pattern issue',()=>{
 for(const pattern of ['[','(','\\']) for(const body of bodies) {
  const result=body({validation:{pattern}}); assert.equal(result.success,false);
  assert.deepEqual(result.error.issues.map(issue=>({code:issue.code,path:issue.path,message:issue.message})),
   [{code:'custom',path:['validation','pattern'],message:'Invalid validation pattern'}]);
 }
});
probe('P03','create/update reject non-string pattern values',()=>{
 for(const pattern of [null,5,{},[],true]) for(const body of bodies)
  assert.equal(body({validation:{pattern}}).success,false);
});
probe('P04','request omission, undefined, null and empty object remain distinct',()=>{
 assert.deepEqual(updateFieldBody.parse({}),{});
 assert.deepEqual(updateFieldBody.parse({validation:undefined}),{validation:undefined});
 assert.deepEqual(updateFieldBody.parse({validation:null}),{validation:null});
 assert.deepEqual(updateFieldBody.parse({validation:{}}),{validation:{}});
});
probe('P05','upstream request strips unknown validation keys',()=>{
 assert.deepEqual(updateFieldBody.parse({validation:{pattern:'a',unsupported:true}}),{validation:{pattern:'a'}});
});
probe('P06','pattern syntax and length-range issues accumulate',()=>{
 const result=updateFieldBody.safeParse({validation:{pattern:'[',minLength:5,maxLength:1}});
 assert.equal(result.success,false);
 assert.deepEqual(result.error.issues.map(issue=>issue.path),[['validation','maxLength'],['validation','pattern']]);
});
probe('P07','create metadata stores exact empty, whitespace and Unicode sources',()=>fixture(async(db,r)=>{
 for(const type of ['string','text']) for(const [i,pattern] of ['', ' ', '^é+$'].entries()) {
  const slug=type+'_'+i;const created=await r.createField('posts',createFieldBody.parse({slug,label:slug,type,validation:{pattern}}));
  assert.deepEqual(created.validation,{pattern});assert.equal(await validationCell(db,slug),JSON.stringify({pattern}));
 }
}));
probe('P08','omitted validation and unrelated metadata edits preserve pattern',()=>withPatterns('^a$',async(db,r)=>{
 for(const slug of ['string','text']) {
  await r.updateField('posts',slug,{label:'Changed',validation:undefined});
  assert.deepEqual((await r.getField('posts',slug)).validation,{pattern:'^a$'});
 }
}));
probe('P09','pattern-only update replaces previous length validation',()=>fixture(async(db,r)=>{
 for(const slug of ['string','text']) {
  await r.updateField('posts',slug,{validation:{minLength:2,maxLength:3}});
  assert.deepEqual((await r.updateField('posts',slug,{validation:{pattern:'a'}})).validation,{pattern:'a'});
 }
}));
probe('P10','length-only update removes previous pattern',()=>withPatterns('a',async(db,r)=>{
 for(const slug of ['string','text']) assert.deepEqual((await r.updateField('posts',slug,{validation:{maxLength:3}})).validation,{maxLength:3});
}));
probe('P11','empty pattern remains a real JSON metadata property',()=>withPatterns('',async(db,r)=>{
 for(const slug of ['string','text']) {
  assert.deepEqual((await r.getField('posts',slug)).validation,{pattern:''});
  assert.equal(await validationCell(db,slug),'{"pattern":""}');
 }
}));
probe('P12','null clears SQL NULL and maps to undefined while empty object stays JSON',()=>withPatterns('a',async(db,r)=>{
 for(const slug of ['string','text']) {
  assert.equal((await r.updateField('posts',slug,{validation:null})).validation,undefined);
  assert.equal(await validationCell(db,slug),null);
  assert.deepEqual((await r.updateField('posts',slug,{validation:{}})).validation,{});
  assert.equal(await validationCell(db,slug),'{}');
 }
}));
probe('P13','pattern edit preserves physical schema, existing rows and collection metadata',()=>fixture(async(db,r)=>{
 await db.insertInto('ec_posts').values({id:'old',string:'old invalid',text:'old invalid'}).execute();
 const before=await state(db);
 for(const slug of ['string','text']) await r.updateField('posts',slug,{validation:{pattern:'^new$'}});
 assert.deepEqual(await state(db),before);
 await successful(db,{string:'new',text:'new'});
 assert.equal((await check(db,{string:'old invalid',text:'old invalid'})).ok,false);
}));
probe('P14','persisted malformed regex survives read but throws for full/partial absent/null/supplied validation',()=>fixture(async(db,r)=>{
 await db.updateTable('_emdash_fields').set({validation:JSON.stringify({pattern:'['})}).where('slug','=','string').execute();
 assert.deepEqual((await r.getField('posts','string')).validation,{pattern:'['});
 await r.updateField('posts','string',{label:'Legacy metadata'});
 for(const partial of [false,true]) for(const data of [{},{string:null},{string:'a'}])
  await assert.rejects(()=>check(db,data,partial),SyntaxError);
}));
probe('P15','direct registry accepts malformed pattern rather than checking request syntax',()=>fixture(async(db,r)=>{
 const created=await r.createField('posts',{slug:'legacy',label:'Legacy',type:'string',validation:{pattern:'['}});
 assert.deepEqual(created.validation,{pattern:'['});
 assert.deepEqual((await r.updateField('posts','text',{validation:{pattern:'('}})).validation,{pattern:'('});
}));
probe('P16','pattern metadata and enforcement survive actual SQLite/local D1 reopen',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'emdash-pattern-restart-'));let h;
 try {
  await fixture(async(db,r)=>{
   await r.updateField('posts','string',{validation:{pattern:'^persisted$'}});
   await r.updateField('posts','text',{validation:{pattern:''}});
  },directory);
  h=await schemaAdminStorage(target,directory);const r=new SchemaRegistry(h.database.db);
  assert.deepEqual((await r.getField('posts','string')).validation,{pattern:'^persisted$'});
  assert.deepEqual((await r.getField('posts','text')).validation,{pattern:''});
  await successful(h.database.db,{string:'persisted',text:'anything'});
  assert.equal((await check(h.database.db,{string:'invalid'})).ok,false);
 } finally {await h?.close();await rm(directory,{recursive:true,force:true});}
});
probe('P17','matching supplied string/text values pass full and partial validation',()=>withPatterns('^a+$',async db=>{
 for(const partial of [false,true]) await successful(db,{string:'aaa',text:'aaa'},partial);
}));
probe('P18','nonmatching supplied values expose invalid_format and regex format',()=>withPatterns('^a+$',async db=>{
 for(const partial of [false,true]) for(const slug of ['string','text']) {
  const result=await check(db,{[slug]:'bbb'},partial);assert.equal(result.ok,false);
  assert.equal(result.error.code,'VALIDATION_ERROR');
  assert.deepEqual(result.error.details.issues,[{path:slug,code:'invalid_format',message:'Invalid string: must match pattern /^a+$/',format:'regex'}]);
 }
}));
probe('P19','unanchored source matches substrings',()=>withPatterns('a',async db=>{
 await successful(db,{string:'before a after',text:'cat'});
}));
probe('P20','anchors reject matching substrings',()=>withPatterns('^a$',async db=>{
 assert.equal((await check(db,{string:'cat',text:'cat'})).ok,false);
}));
probe('P21','regex has no case-insensitive flag',()=>withPatterns('^a$',async db=>{
 assert.equal((await check(db,{string:'A',text:'A'})).ok,false);
}));
probe('P22','slash-looking source is literal source rather than parsed flags',()=>withPatterns('/a/i',async db=>{
 await successful(db,{string:'/a/i',text:'has /a/i inside'});
 assert.equal((await check(db,{string:'A',text:'a'})).ok,false);
}));
probe('P23','whitespace pattern is preserved and enforced',()=>withPatterns(' ',async db=>{
 await successful(db,{string:'a b',text:' '});assert.equal((await check(db,{string:'ab',text:'ab'})).ok,false);
}));
probe('P24','empty source disables regex checking',()=>withPatterns('',async db=>{
 await successful(db,{string:'',text:'anything'});await successful(db,{string:'x',text:''},true);
}));
probe('P25','optional omission, explicit undefined and null bypass regex',()=>withPatterns('^a$',async db=>{
 for(const partial of [false,true]) for(const data of [{},{string:undefined,text:undefined},{string:null,text:null}])
  await successful(db,data,partial);
}));
probe('P26','required missing and null fail as required',()=>withPatterns('^a$',async db=>{
 for(const data of [{},{string:null,text:null}]) {
  const result=await check(db,data);assert.equal(result.ok,false);
  assert.deepEqual(result.error.details.issues.map(issue=>issue.code),['required','required']);
 }
},{required:true}));
probe('P27','required empty stays rejected even when regex matches empty',()=>withPatterns('^$',async db=>{
 for(const partial of [false,true]) {
  const result=await check(db,{string:'',text:''},partial);assert.equal(result.ok,false);
  assert.deepEqual(result.error.details.issues.map(issue=>issue.code),['required','required']);
 }
},{required:true}));
probe('P28','partial omitted required field passes while supplied nonmatch fails',()=>withPatterns('^a$',async db=>{
 await successful(db,{},true);assert.equal((await check(db,{string:'b'},true)).ok,false);
},{required:true}));
probe('P29','length and regex checks compose independently',()=>fixture(async(db,r)=>{
 for(const slug of ['string','text']) await r.updateField('posts',slug,{validation:{minLength:2,maxLength:3,pattern:'^a+$'}});
 for(const partial of [false,true]) {
  await successful(db,{string:'aa',text:'aaa'},partial);
  for(const value of ['a','aaaa','bb']) assert.equal((await check(db,{string:value,text:value},partial)).ok,false);
  assert.deepEqual((await check(db,{string:'b'},partial)).error.details.issues.map(issue=>issue.code),['too_small','invalid_format']);
 }
}));
probe('P30','omitted default bypasses regex without mutating input or SQL default',()=>withPatterns('^a$',async(db,r)=>{
 for(const slug of ['string','text']) await r.updateField('posts',slug,{defaultValue:'invalid default'});
 const data={};await successful(db,data);assert.deepEqual(data,{});
 await db.insertInto('ec_posts').values({id:'omitted'}).execute();
 const row=await db.selectFrom('ec_posts').selectAll().executeTakeFirst();assert.equal(row.string,'');assert.equal(row.text,'');
 assert.equal((await check(db,{string:'invalid default'})).ok,false);
},{required:true}));
probe('P31','partial omitted default bypasses regex and validation returns only ok',()=>withPatterns('^a$',async(db,r)=>{
 for(const slug of ['string','text']) await r.updateField('posts',slug,{defaultValue:'invalid default'});
 const data={};await successful(db,data,true);assert.deepEqual(data,{});
}));
probe('P32','regex has no Unicode flag and uses UTF-16 units',()=>withPatterns('^.$',async(db,r)=>{
 assert.equal((await check(db,{string:'😀',text:'😀'})).ok,false);
 for(const slug of ['string','text']) await r.updateField('posts',slug,{validation:{pattern:'^..$'}});
 await successful(db,{string:'😀',text:'😀'});
}));
`);
  const output = join(directory, 'bundle.mjs');
  await build({ configFile: false, logLevel: 'error', plugins: [{
    name: 'bounded-pattern-fixture',
    resolveId(source, importer) {
      if (importer === registryPath && fixtureModules.has(source)) return '\0pattern-fixture:' + source;
      if (source === 'zod') return join(directory, 'zod/node_modules/zod/index.js');
      if (source === 'kysely-d1') return join(directory, 'package/dist/index.js');
      if (source === 'emdash/internal/database/migration-lock') return join(directory, 'packages/core/src/database/migration-lock.ts');
    },
    load(id) { if (id.startsWith('\0pattern-fixture:')) return fixtureModules.get(id.slice('\0pattern-fixture:'.length)); }
  }], build: { target: 'node24', minify: false, outDir: directory, emptyOutDir: false,
    lib: { entry: join(directory, 'entry.ts'), formats: ['es'], fileName: () => 'bundle.mjs' },
    rollupOptions: { external: ['node:test', 'node:assert/strict', 'node:fs/promises','node:os','node:path','node:sqlite', 'kysely', 'ulidx', 'miniflare'] }
  } });
  for (const target of ['Node', 'D1']) execFileSync(process.execPath, ['--test', output], {
    env: { ...process.env, CMS_UPSTREAM_TARGET: target }, stdio: 'inherit'
  });
  console.log(JSON.stringify({ pin, sources, fixtureBoundaries: [...fixtureModules.keys()],
    supplementalProbesPerTarget:32, targets:['Node','D1'], zod:'4.5.4',
    sourceAssertionExpressionsExecuted:3, sourceAssertionEvaluationsPerTarget:9,
    adaptedCompleteSourceDeclarationsExecuted:1, completeMcpTransportDeclarationsExecuted:0,
    probeEntrySha256:createHash('sha256').update(await readFile(join(directory,'entry.ts'))).digest('hex'),
    omissions:['MCP/REST transport and remaining source test declarations','upstream migrations',
      'media/FTS/type-generation subsystems','full schema types','deployed Node/Cloudflare hosting'] }));
} finally { await rm(directory, { recursive: true, force: true }); }
