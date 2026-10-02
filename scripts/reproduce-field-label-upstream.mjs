// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// Runs the complete immutable upstream registry and request schema against
// one partial source assertion plus original supplemental field-label probes.
// See docs/field-label.md for assertion credit and fixture boundaries.
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
const directory = await mkdtemp(join(tmpdir(), 'cms-upstream-field-label-'));
const sources = [
  ['packages/core/src/schema/registry.ts', 'da7bbcdda224dfca8d9146b2f36659ab90bcac2e'],
  ['packages/core/tests/unit/schema/registry.test.ts', '7e1413acd99071e888693021224a9644efa2a8c5'],
  ['packages/core/src/database/transaction.ts', '69bf167998a2fa9cc228c3612a69c8fde5ed85fe'],
  ['packages/cloudflare/src/db/d1-dialect.ts', 'b026d293554c5173e1447b5eff0d704e169d3384']
];
sources.push(
  ['packages/core/src/api/schemas/schema.ts', '57e0338b8e1a7633d1e3409f4a38b39f73469e68'],
  ['packages/core/src/api/schemas/common.ts', 'ba9be767aa9a2c564f3ebfd2c4106ad904324c59'],
  ['packages/core/src/i18n/config.ts', 'fe714e5ad514485fe1737585c663e470d50519df'],
  ['packages/admin/src/components/FieldEditor.tsx', 'f918b302b527d150f3f51fdfa1ebf1facc0fe7ba'],
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
    execFileSync('curl', ['-fsSL', `https://raw.githubusercontent.com/emdash-cms/emdash/${pin}/${path}`, '-o', destination]);
    if (blob) {
      const content = await readFile(destination);
      const actual = createHash('sha1').update(`blob ${content.length}\0`).update(content).digest('hex');
      if (actual !== blob) throw new Error(`upstream blob mismatch: ${path}: ${actual}`);
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
      : `export function ${name}() { throw new Error(${JSON.stringify(`outside field-label fixture: ${path}:${name}`)}); }`).join('\n'));
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

  // Source inspection of the unmodified FieldEditor is distinct from rendered UI parity.
  const editorSource = await readFile(join(directory, 'packages/admin/src/components/FieldEditor.tsx'), 'utf8');
  if (!editorSource.includes('...(field ? {} : { slug: slugifyLabel(value) })') ||
      !editorSource.includes('disabled={!!field}') ||
      !editorSource.includes('onChange={(e) => handleLabelChange(e.target.value)}')) {
    throw new Error('Pinned existing-label/edit-disabled-slug source contract changed');
  }
  await writeFile(join(directory, 'entry.ts'), `
import test from 'node:test'; import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises'; import {tmpdir} from 'node:os'; import {join} from 'node:path';
import {sql} from 'kysely';
import {SchemaRegistry,SchemaError} from './packages/core/src/schema/registry.ts';
import {updateFieldBody} from './packages/core/src/api/schemas/schema.ts';
import {migrateCms,schemaAdminStorage} from './fixture.ts';
const target=process.env.CMS_UPSTREAM_TARGET;
async function fixture(run) {
 const h=await schemaAdminStorage(target);
 try {await migrateCms(h.database);const db=h.database.db;const r=new SchemaRegistry(db);
  await r.createCollection({slug:'posts',label:'Posts'});
  await r.createField('posts',{slug:'title',label:'Title',type:'string'});
  await run(db,r);
 } finally {await h.close();}
}
async function snapshot(db) {
 const schema=await sql.raw("SELECT name,type,sql FROM sqlite_schema WHERE type IN ('table','index') ORDER BY name").execute(db);
 return {schema:JSON.parse(JSON.stringify(schema.rows)),
  collections:await db.selectFrom('_emdash_collections').selectAll().orderBy('slug').execute(),
  fields:await db.selectFrom('_emdash_fields').selectAll().orderBy('slug').execute(),
  content:await db.selectFrom('ec_posts').selectAll().execute()};
}
test(target+': partial registry.test.ts:668 label expression (1/3; zero complete declarations)',()=>fixture(async(db,r)=>{
 const updated=await r.updateField('posts','title',{label:'Post Title'});
 assert.equal(updated.label,'Post Title');
}));
test(target+': supplemental exact request-label boundaries, optional label and stripped extra keys',async()=>{
 for(const label of ['  Label  ','   ','x'.repeat(201),'x'.repeat(10001)])
  assert.equal(updateFieldBody.parse({label}).label,label);
 for(const label of ['',null,3]) assert.equal(updateFieldBody.safeParse({label}).success,false);
 assert.deepEqual(updateFieldBody.parse({}),{});
 assert.deepEqual(updateFieldBody.parse({label:'Title',unexpected:'ignored'}),{label:'Title'});
});
test(target+': supplemental exact labels preserve all other metadata, DDL, indexes, content and collection timestamp',()=>fixture(async(db,r)=>{
 await db.insertInto('ec_posts').values({id:'draft',title:'Stored value'}).execute();
 const original=await snapshot(db);
 for(const label of ['  Label  ','   ','x'.repeat(201),'x'.repeat(10001)]) {
  const updated=await r.updateField('posts','title',updateFieldBody.parse({label}));
  assert.equal(updated.label,label);
  const after=await snapshot(db);after.fields[0].label=original.fields[0].label;
  assert.deepEqual(after,original);
 }
}));
test(target+': supplemental repeated-label and last-writer-wins edits coexist with collection metadata and addition',()=>fixture(async(db,r)=>{
 const before=await r.getCollection('posts');
 await r.updateField('posts','title',{label:'First'});
 await r.updateField('posts','title',{label:'First'});
 await r.updateCollection('posts',{label:'Blog Posts'});
 await r.updateField('posts','title',{label:'Second'});
 await r.createField('posts',{slug:'body',label:'Body',type:'text'});
 assert.equal((await r.getField('posts','title')).label,'Second');
 assert.equal((await r.getCollection('posts')).label,'Blog Posts');
 const afterMetadata=await r.getCollection('posts');
 await r.updateField('posts','title',{label:'Last'});
 assert.equal((await r.getField('posts','title')).label,'Last');
 assert.equal((await r.getCollection('posts')).updatedAt,afterMetadata.updatedAt);
 assert.equal(before.version,undefined);assert.equal(afterMetadata.version,undefined);
}));
test(target+': supplemental missing collection/field rejects and persists no changes',()=>fixture(async(db,r)=>{
 const before=await snapshot(db);
 for(const [collection,field] of [['missing','title'],['posts','missing']])
  await assert.rejects(()=>r.updateField(collection,field,{label:'Missing'}),e=>e instanceof SchemaError && e.code==='FIELD_NOT_FOUND');
 assert.deepEqual(await snapshot(db),before);
}));
test(target+': supplemental label survives actual SQLite/local D1 restart',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'emdash-field-label-restart-'));
 let h=await schemaAdminStorage(target,directory);
 try {
  await migrateCms(h.database);let r=new SchemaRegistry(h.database.db);
  await r.createCollection({slug:'posts',label:'Posts'});
  await r.createField('posts',{slug:'title',label:'Title',type:'string'});
  await r.updateField('posts','title',{label:'  Persisted  '});
  const before=await snapshot(h.database.db);await h.close();h=await schemaAdminStorage(target,directory);
  r=new SchemaRegistry(h.database.db);
  assert.equal((await r.getField('posts','title')).label,'  Persisted  ');
  assert.deepEqual(await snapshot(h.database.db),before);
 }finally{await h.close();await rm(directory,{recursive:true,force:true});}
});
`);
  const output = join(directory, 'bundle.mjs');
  await build({ configFile: false, logLevel: 'error', plugins: [{
    name: 'bounded-field-label-fixture',
    resolveId(source, importer) {
      if (importer === registryPath && fixtureModules.has(source)) return '\0field-label-fixture:' + source;
      if (source === 'zod') return join(directory, 'zod/node_modules/zod/index.js');
      if (source === 'kysely-d1') return join(directory, 'package/dist/index.js');
      if (source === 'emdash/internal/database/migration-lock') return join(directory, 'packages/core/src/database/migration-lock.ts');
    },
    load(id) { if (id.startsWith('\0field-label-fixture:')) return fixtureModules.get(id.slice('\0field-label-fixture:'.length)); }
  }], build: { target: 'node24', minify: false, outDir: directory, emptyOutDir: false,
    lib: { entry: join(directory, 'entry.ts'), formats: ['es'], fileName: () => 'bundle.mjs' },
    rollupOptions: { external: ['node:test', 'node:assert/strict', 'node:fs/promises','node:os','node:path','node:sqlite', 'kysely', 'ulidx', 'miniflare'] }
  } });
  for (const target of ['Node', 'D1']) execFileSync(process.execPath, ['--test', output], {
    env: { ...process.env, CMS_UPSTREAM_TARGET: target }, stdio: 'inherit'
  });
  console.log(JSON.stringify({ pin, sources, fixtureBoundaries: [...fixtureModules.keys()],
    partialSourceExpressions:1, completeSourceDeclarations:0, omittedSourceExpressions:2,
    partialCases:2, supplementalCases:10, targets:['Node','D1'], zod:'4.5.4',
    editorEvidence:'verified pinned source: existing label handler and disabled slug; no rendered React/UI parity',
    probeEntrySha256:createHash('sha256').update(await readFile(join(directory,'entry.ts'))).digest('hex') }));
} finally { await rm(directory, { recursive: true, force: true }); }
