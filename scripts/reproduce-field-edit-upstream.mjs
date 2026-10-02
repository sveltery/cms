// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// Runs the complete immutable upstream registry and request schema against
// selected partial/adapted source expectations and supplemental field-edit probes.
// See docs/field-edit.md for assertion credit and fixture boundaries.
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
const directory = await mkdtemp(join(tmpdir(), 'cms-upstream-field-edit-'));
const sources = [
  [
    "packages/core/src/schema/registry.ts",
    "da7bbcdda224dfca8d9146b2f36659ab90bcac2e"
  ],
  [
    "packages/core/tests/integration/mcp/schema.test.ts",
    "4c1d5c283a19f4262b84cc5165b70f2046ba8b43"
  ],
  [
    "packages/core/src/database/repositories/content.ts",
    "29dab9decf9af0d9fb21b464dc185ed48ab958ea"
  ],
  [
    "packages/core/tests/unit/schema/registry.test.ts",
    "7e1413acd99071e888693021224a9644efa2a8c5"
  ],
  [
    "packages/core/src/database/transaction.ts",
    "69bf167998a2fa9cc228c3612a69c8fde5ed85fe"
  ],
  [
    "packages/cloudflare/src/db/d1-dialect.ts",
    "b026d293554c5173e1447b5eff0d704e169d3384"
  ],
  [
    "packages/core/src/api/handlers/validation.ts",
    "a9e40d310098e2329e166614fa10fcea1b53c84d"
  ],
  [
    "packages/core/src/schema/zod-generator.ts",
    "550d4918258aa52a0d0f272b69061c76e79d86ee"
  ],
  [
    "packages/core/src/utils/hash.ts",
    "93db9df4a2b88692d5772fa5e32d309d7f23fab8"
  ],
  [
    "packages/core/src/utils/url.ts",
    "5ea627417b29212beeb178863f7b2f4989f90d58"
  ],
  [
    "packages/core/src/api/schemas/schema.ts",
    "57e0338b8e1a7633d1e3409f4a38b39f73469e68"
  ],
  [
    "packages/core/src/api/schemas/common.ts",
    "ba9be767aa9a2c564f3ebfd2c4106ad904324c59"
  ],
  [
    "packages/core/src/i18n/config.ts",
    "fe714e5ad514485fe1737585c663e470d50519df"
  ],
  [
    "packages/admin/src/components/FieldEditor.tsx",
    "f918b302b527d150f3f51fdfa1ebf1facc0fe7ba"
  ],
  [
    "packages/core/src/utils/chunks.ts",
    "9ff9f0f4082b9f32e5c9f851a0a30cef1459048e"
  ],
  [
    "packages/core/src/schema/types.ts",
    "0c2f44156cff829951c52b0dd259fc5ff45bc554"
  ],
  [
    "packages/core/src/schema/url-pattern.ts",
    "1b9776eb0ab18119c46bceeeff2459db555bc41e"
  ],
  [
    "packages/core/src/database/dialect-helpers.ts",
    "d2883911f5c0a158ddcdf72e3b35020c377a8c24"
  ],
  [
    "packages/core/src/database/validate.ts",
    "73d3b303764b473d4238e0cb17f1a904998671f8"
  ],
  [
    "packages/cloudflare/src/db/d1-introspector.ts",
    "4c40fc55aa449f46f887f9335d11b42633312225"
  ],
  [
    "packages/core/src/database/migration-lock.ts",
    "160cce48c64a6c815ec780bef8fc2646be5b5ec9"
  ],
  [
    "packages/core/src/database/pg-migration-lock.ts",
    "cf8fd580c4549e50e1d6ef0a0cb8515579bb6bc3"
  ],
  [
    "packages/core/src/utils/db-errors.ts",
    "d0a051ad9d48003eeeeb38dd9d5cb7cedf4140e5"
  ],
  [
    "packages/core/src/database/repositories/types.ts",
    "abcf7a35f71936c2e8953f7bbd18b32fa1282bb7"
  ],
  [
    "packages/core/src/database/content-datetime.ts",
    "06be050e17d7760ae1df2073632845ba15e034c2"
  ],
  [
    "packages/core/src/datetime-normalization.ts",
    "eb31fb99e2d1e41c6001c5aec3ae49d82e39c345"
  ],
  [
    "packages/core/src/request-cache.ts",
    "ab8f007b22ce601219ca1270d487342338de8634"
  ],
  [
    "packages/core/src/request-context.ts",
    "4f140c77a1dca951defb43fd1a114e838b6f691f"
  ],
  [
    "packages/core/src/utils/base64.ts",
    "9dae6dade270b1c1291b21c8a90adc73f5dab294"
  ]
];

try {
  const sourceSha256 = [];
  for (const [path, blob] of sources) {
    const destination = join(directory, path); await mkdir(dirname(destination), { recursive: true });
    execFileSync('curl', ['-fsSL', `https://raw.githubusercontent.com/emdash-cms/emdash/${pin}/${path}`, '-o', destination]);
    {
      const content = await readFile(destination);
      const actual = createHash('sha1').update(`blob ${content.length}\0`).update(content).digest('hex');
      if (actual !== blob) throw new Error(`upstream blob mismatch: ${path}: ${actual}`);
      sourceSha256.push([path, createHash('sha256').update(content).digest('hex')]);
    }
  }
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
      : `export function ${name}() { throw new Error(${JSON.stringify(`outside field-edit fixture: ${path}:${name}`)}); }`).join('\n'));
  }
  const contentPath = join(directory, 'packages/core/src/database/repositories/content.ts');
  const contentAst = ts.createSourceFile(contentPath, await readFile(contentPath, 'utf8'), ts.ScriptTarget.Latest, true);
  const contentRealImports = new Set(['kysely', 'ulidx', '../content-datetime.js', '../transaction.js',
    '../dialect-helpers.js', '../validate.js', './types.js', '../../schema/types.js',
    '../../utils/chunks.js', '../../utils/db-errors.js', '../../datetime-normalization.js']);
  const contentFixtures = new Map();
  for (const statement of contentAst.statements) {
    if (!ts.isImportDeclaration(statement) || statement.importClause?.isTypeOnly) continue;
    const path = statement.moduleSpecifier.text;
    if (contentRealImports.has(path)) continue;
    const names = (statement.importClause?.namedBindings?.elements ?? [])
      .filter(element => !element.isTypeOnly).map(element => element.propertyName?.text ?? element.name.text);
    if (!names.length) continue;
    contentFixtures.set(path, names.map(name => name === 'invalidateCollectionCache'
      ? 'export function invalidateCollectionCache() {}'
      : `export function ${name}() { throw new Error(${JSON.stringify(`outside field-edit content fixture: ${path}:${name}`)}); }`).join('\n'));
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
  await sql\`CREATE TABLE options (name TEXT PRIMARY KEY, value TEXT)\`.execute(db);
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

  await writeFile(join(directory, 'entry.ts'), `
import test from 'node:test'; import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises'; import {tmpdir} from 'node:os'; import {join} from 'node:path';
import {sql} from 'kysely';
import {SchemaRegistry,SchemaError} from './packages/core/src/schema/registry.ts';
import {ContentRepository} from './packages/core/src/database/repositories/content.ts';
import {updateFieldBody} from './packages/core/src/api/schemas/schema.ts';
import {validateContentData} from './packages/core/src/api/handlers/validation.ts';
import {migrateCms,schemaAdminStorage} from './fixture.ts';
const target=process.env.CMS_UPSTREAM_TARGET;
async function fixture(run) {
 const h=await schemaAdminStorage(target);
 try {await migrateCms(h.database);const db=h.database.db;const r=new SchemaRegistry(db);
  await r.createCollection({slug:'posts',label:'Posts'});
  await r.createField('posts',{slug:'title',label:'Title',type:'string'});
  await r.createCollection({slug:'post',label:'Posts'});
  await r.createField('post',{slug:'body',label:'Body',type:'text'});
  await run(db,r);
 } finally {await h.close();}
}
async function snapshot(db) {
 const schema=await sql.raw("SELECT name,type,sql FROM sqlite_schema WHERE type IN ('table','index') ORDER BY name").execute(db);
 return {schema:schema.rows.map(row=>({...row})),
  collections:await db.selectFrom('_emdash_collections').selectAll().orderBy('slug').execute(),
  fields:await db.selectFrom('_emdash_fields').selectAll().orderBy('slug').execute(),
  content:await db.selectFrom('ec_posts').selectAll().orderBy('id').execute()};
}
test(target+': partial registry.test.ts:668 label/order expressions (2/3; widget omitted)',()=>fixture(async(db,r)=>{
 const updated=await r.updateField('posts','title',{label:'Post Title',sortOrder:3});
 assert.equal(updated.label,'Post Title'); assert.equal(updated.sortOrder,3);
}));
test(target+': adapted MCP schema.test.ts:1003 both concurrent partial-update expressions',()=>fixture(async(db,r)=>{
 await Promise.all([r.updateField('post','body',{label:'Summary'}),r.updateField('post','body',{sortOrder:7})]);
 const field=await r.getField('post','body');
 assert.equal(field?.label,'Summary'); assert.equal(field?.sortOrder,7);
}));
test(target+': supplemental exact optional request keys, integers and min/max pair contract',async()=>{
 for(const label of ['  Label  ','   ','x'.repeat(10001)]) assert.equal(updateFieldBody.parse({label}).label,label);
 for(const label of ['',null,3]) assert.equal(updateFieldBody.safeParse({label}).success,false);
 assert.deepEqual(updateFieldBody.parse({}),{});
 for(const value of [0,7,Number.MAX_SAFE_INTEGER]) {
  assert.equal(updateFieldBody.parse({sortOrder:value}).sortOrder,value);
  assert.equal(updateFieldBody.parse({validation:{minLength:value}}).validation.minLength,value);
  assert.equal(updateFieldBody.parse({validation:{maxLength:value}}).validation.maxLength,value);
 }
 for(const value of [-1,0.5,Number.MAX_SAFE_INTEGER+1,Infinity,NaN,'7',null]) {
  assert.equal(updateFieldBody.safeParse({sortOrder:value}).success,false);
  assert.equal(updateFieldBody.safeParse({validation:{minLength:value}}).success,false);
  assert.equal(updateFieldBody.safeParse({validation:{maxLength:value}}).success,false);
 }
 for(const validation of [null,{}, {minLength:0,maxLength:0},{minLength:5,maxLength:5},{maxLength:1}])
  assert.deepEqual(updateFieldBody.parse({validation}).validation,validation);
 const invalid=updateFieldBody.safeParse({validation:{minLength:5,maxLength:4}});
 assert.equal(invalid.success,false); assert.deepEqual(invalid.error.issues[0].path,['validation','maxLength']);
 assert.equal(updateFieldBody.parse({defaultValue:''}).defaultValue,'');
 assert.equal(updateFieldBody.parse({defaultValue:'\u0000'+'x'.repeat(100001)}).defaultValue.length,100002);
 // Upstream accepts a broader unknown default domain, including null. The local
 // string-only metadata slice deliberately excludes null; no clear sentinel is inferred.
 assert.equal(updateFieldBody.parse({defaultValue:null}).defaultValue,null);
 assert.deepEqual(updateFieldBody.parse({label:'Title',unknown:'stripped'}),{label:'Title'});
});
test(target+': supplemental supplied-key updates preserve omissions, replace validation and distinguish null from empty object',()=>fixture(async(db,r)=>{
 await db.insertInto('ec_posts').values({id:'saved',title:'Stored value'}).execute();
 await r.updateField('posts','title',{label:'  Label  ',sortOrder:9,defaultValue:'metadata',validation:{minLength:2,maxLength:90}});
 const before=await snapshot(db);
 await r.updateField('posts','title',{}); assert.deepEqual(await snapshot(db),before);
 const replaced=await r.updateField('posts','title',{validation:{maxLength:1}});
 assert.deepEqual(replaced.validation,{maxLength:1}); assert.equal(replaced.defaultValue,'metadata');
 assert.equal(replaced.label,'  Label  '); assert.equal(replaced.sortOrder,9);
 // Upstream row mapping represents cleared SQL NULL validation as undefined.
 assert.equal((await r.updateField('posts','title',{validation:null})).validation,undefined);
 assert.equal((await db.selectFrom('_emdash_fields').select('validation').where('slug','=','title').executeTakeFirst()).validation,null);
 assert.deepEqual((await r.updateField('posts','title',{validation:{}})).validation,{});
 const empty=await snapshot(db);
 assert.equal(empty.fields.find(field=>field.slug==='title').validation,'{}');
 assert.deepEqual(empty.schema,before.schema); assert.deepEqual(empty.content,before.content);
 assert.deepEqual(empty.collections,before.collections);
 await r.updateField('posts','title',{defaultValue:''});
 assert.equal((await r.getField('posts','title')).defaultValue,'');
 assert.deepEqual((await r.getField('posts','title')).validation,{});
}));
test(target+': supplemental metadata defaults leave all 12 string/text optional/required physical layouts and raw/content omitted inserts unchanged',()=>fixture(async(db,r)=>{
 const repo=new ContentRepository(db); let index=0;
 for(const type of ['string','text']) for(const required of [false,true]) for(const initial of [undefined,'old SQL value','']) {
  const slug='probe_'+index++; const table='ec_'+slug;
  await r.createCollection({slug,label:'Probe'});
  await r.createField(slug,{slug:'value',label:'Value',type,required,...(initial===undefined?{}:{defaultValue:initial})});
  await repo.create({id:'content_before',type:slug,data:{value:'Stored content'}});
  await sql.raw('INSERT INTO '+table+"(id) VALUES ('raw_before')").execute(db);
  const ddl=await sql.raw("SELECT name,sql FROM sqlite_schema WHERE tbl_name='"+table+"' ORDER BY name").execute(db);
  const before=await db.selectFrom(table).selectAll().orderBy('id').execute();
  const physical=required?(initial??''):null;
  assert.equal(before.find(row=>row.id==='raw_before').value,physical);
  assert.equal((await validateContentData(db,slug,{},{})).ok,!required||initial!==undefined);
  const edited=await r.updateField(slug,'value',updateFieldBody.parse({defaultValue:'new metadata value',validation:{maxLength:1}}));
  assert.equal(edited.defaultValue,'new metadata value'); assert.deepEqual(edited.validation,{maxLength:1});
  assert.deepEqual((await sql.raw("SELECT name,sql FROM sqlite_schema WHERE tbl_name='"+table+"' ORDER BY name").execute(db)).rows,ddl.rows);
  assert.deepEqual(await db.selectFrom(table).selectAll().orderBy('id').execute(),before);
  assert.equal((await validateContentData(db,slug,{},{})).ok,true);
  // Repository inserts use input own keys and the original SQL layout. Parsed
  // schema defaults are not materialized into handler/repository input data.
  await repo.create({id:'content_after',type:slug,data:{}});
  await sql.raw('INSERT INTO '+table+"(id) VALUES ('raw_after')").execute(db);
  const after=await db.selectFrom(table).selectAll().execute();
  assert.equal(after.find(row=>row.id==='content_after').value,physical);
  assert.equal(after.find(row=>row.id==='raw_after').value,physical);
  assert.equal((await repo.findById(slug,'content_before')).data.value,'Stored content');
 }
}));
test(target+': supplemental MCP schema.test.ts:982 validation observations only; old content readable and future full/partial writes checked',()=>fixture(async(db,r)=>{
 assert.equal((await validateContentData(db,'post',{body:'primes the cache'})).ok,true);
 const repo=new ContentRepository(db);const old=await repo.create({id:'old',type:'post',data:{body:'primes the cache'}});
 const collection=await r.getCollection('post');
 await r.updateField('post','body',{validation:{maxLength:1},defaultValue:'default remains longer than the new bound'});
 assert.equal((await validateContentData(db,'post',{body:'too long'})).ok,false);
 assert.equal((await validateContentData(db,'post',{body:'too long'},{partial:true})).ok,false);
 assert.equal((await validateContentData(db,'post',{body:'x'})).ok,true);
 assert.deepEqual(await repo.findById('post','old'),old);
 assert.deepEqual(await r.getCollection('post'),collection);
}));
test(target+': supplemental metadata survives actual Node SQLite/local D1 reopen',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'emdash-field-edit-restart-'));
 let h=await schemaAdminStorage(target,directory);
 try {
  await migrateCms(h.database);let r=new SchemaRegistry(h.database.db);
  await r.createCollection({slug:'posts',label:'Posts'}); await r.createField('posts',{slug:'title',label:'Title',type:'string'});
  await h.database.db.insertInto('ec_posts').values({id:'saved',title:'Retained'}).execute();
  await r.updateField('posts','title',{label:'  Persisted  ',sortOrder:7,defaultValue:'',validation:{}});
  const before=await snapshot(h.database.db);await h.close();h=await schemaAdminStorage(target,directory);
  r=new SchemaRegistry(h.database.db);
  assert.equal((await r.getField('posts','title')).label,'  Persisted  ');
  assert.equal((await r.getField('posts','title')).defaultValue,'');
  assert.deepEqual((await r.getField('posts','title')).validation,{});
  assert.deepEqual(await snapshot(h.database.db),before);
 }finally{await h.close();await rm(directory,{recursive:true,force:true});}
});
test(target+': supplemental missing-target and rejected single UPDATE persist no changes',()=>fixture(async(db,r)=>{
 for(const [collection,field] of [['missing','title'],['posts','missing']]) {
  const before=await snapshot(db);
  await assert.rejects(()=>r.updateField(collection,field,{sortOrder:8}),e=>e instanceof SchemaError&&e.code==='FIELD_NOT_FOUND');
  assert.deepEqual(await snapshot(db),before);
 }
 await sql.raw("CREATE TRIGGER reject_metadata BEFORE UPDATE ON _emdash_fields BEGIN SELECT RAISE(ABORT, 'metadata_rejected'); END").execute(db);
 const before=await snapshot(db);
 await assert.rejects(()=>r.updateField('posts','title',{label:'Rejected',sortOrder:7,defaultValue:'metadata',validation:null}),/metadata_rejected/);
 assert.deepEqual(await snapshot(db),before);
}));
`);
  const output = join(directory, 'bundle.mjs');
  await build({ configFile: false, logLevel: 'error', plugins: [{
    name: 'bounded-field-edit-fixture',
    resolveId(source, importer) {
      if (importer === registryPath && fixtureModules.has(source)) return '\0field-edit-fixture:' + source;
      if (importer === contentPath && contentFixtures.has(source)) return '\0field-edit-content-fixture:' + source;
      if (source === 'zod') return join(directory, 'zod/node_modules/zod/index.js');
      if (source === 'kysely-d1') return join(directory, 'package/dist/index.js');
      if (source === 'emdash/internal/database/migration-lock') return join(directory, 'packages/core/src/database/migration-lock.ts');
    },
    load(id) { if (id.startsWith('\0field-edit-content-fixture:')) return contentFixtures.get(id.slice('\0field-edit-content-fixture:'.length)); if (id.startsWith('\0field-edit-fixture:')) return fixtureModules.get(id.slice('\0field-edit-fixture:'.length)); }
  }], build: { target: 'node24', minify: false, outDir: directory, emptyOutDir: false,
    lib: { entry: join(directory, 'entry.ts'), formats: ['es'], fileName: () => 'bundle.mjs' },
    rollupOptions: { external: ['node:async_hooks', 'node:test', 'node:assert/strict', 'node:fs/promises','node:os','node:path','node:sqlite', 'kysely', 'ulidx', 'miniflare'] }
  } });
  for (const target of ['Node', 'D1']) execFileSync(process.execPath, ['--test', output], {
    env: { ...process.env, CMS_UPSTREAM_TARGET: target }, stdio: 'inherit'
  });
  console.log(JSON.stringify({ pin, sources, sourceSha256, fixtureBoundaries: [...fixtureModules.keys()],
    contentFixtureBoundaries: [...contentFixtures.keys()],
    preservedSourceExpressions:4, partialSourceDeclarations:1, adaptedCompleteSourceDeclarations:1,
    omittedSourceExpressions:1, selectedRuntimeCases:4, supplementalRuntimeCases:12,
    targets:['Node','D1'], zod:'4.5.4',
    probeEntrySha256:createHash('sha256').update(await readFile(join(directory,'entry.ts'))).digest('hex') }));
} finally { await rm(directory, { recursive: true, force: true }); }
