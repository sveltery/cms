// Manual immutable-source fixture. Run: node tests/helpers/reproduce-editor-manifest-upstream.mjs
// Executes the complete unchanged upstream registry, manifest and scalar block expansion.
// EmDash is MIT, Copyright 2026 Cloudflare Inc.; see ../../notices/emdash-MIT.txt.
// Downloaded LICENSE is checked below; its blob identity is printed with the evidence.
// Setup directly inserts fixture metadata, rather than running upstream migrations or mutations.
// Only the six output assertions from manifest-build.test.ts:537 are selected; its runtime,
// authentication, mutation setup and the rest of its suite are not executed or claimed.
// Boundary/query-count, constructor, ordering and freshness probes are supplemental evidence.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import ts from 'typescript';

const root = fileURLToPath(new URL('../../', import.meta.url));
const pin = '913cb1bb9b7f08c3ff0d258b4420e53835b6a58e';
const directory = await mkdtemp(join(tmpdir(), 'cms-upstream-editor-manifest-'));
const sources = [
  ['packages/core/src/api/handlers/manifest.ts', 'a8afe936152b9cc5d8a5c426fb98a4103b7612de'],
  ['packages/core/tests/unit/runtime/manifest-build.test.ts', '91f8fddb1472831b984034daa9776edd31d98e07'],
  ['packages/core/src/schema/registry.ts', 'da7bbcdda224dfca8d9146b2f36659ab90bcac2e'],
  ['packages/core/src/utils/chunks.ts', '9ff9f0f4082b9f32e5c9f851a0a30cef1459048e'],
  ['packages/core/src/schema/block-values.ts', '3c29fe8a9cd8a0846cb5873e78336a13aaaa67dc'],
  ['packages/core/src/schema/types.ts', '0c2f44156cff829951c52b0dd259fc5ff45bc554'],
  ['packages/core/src/schema/url-pattern.ts', '1b9776eb0ab18119c46bceeeff2459db555bc41e'],
  ['packages/core/src/utils/db-errors.ts', 'd0a051ad9d48003eeeeb38dd9d5cb7cedf4140e5'],
  ['packages/core/src/utils/hash.ts', '93db9df4a2b88692d5772fa5e32d309d7f23fab8'],
  ['packages/cloudflare/src/db/d1-dialect.ts', 'b026d293554c5173e1447b5eff0d704e169d3384'],
  ['packages/cloudflare/src/db/d1-introspector.ts', '4c40fc55aa449f46f887f9335d11b42633312225'],
  ['packages/core/src/database/migration-lock.ts', '160cce48c64a6c815ec780bef8fc2646be5b5ec9'],
  ['packages/core/src/database/pg-migration-lock.ts', 'cf8fd580c4549e50e1d6ef0a0cb8515579bb6bc3'],
  ['LICENSE', '02cc4b8b0a5f883c5243927e683b00c10588bf4c']
];

try {
  for (const [path, blob] of sources) {
    const destination = join(directory, path);
    await mkdir(dirname(destination), { recursive: true });
    execFileSync('curl', ['--retry', '2', '-fsSL', `https://raw.githubusercontent.com/emdash-cms/emdash/${pin}/${path}`, '-o', destination]);
    const content = await readFile(destination);
    const actual = createHash('sha1').update(`blob ${content.length}\0`).update(content).digest('hex');
    if (actual !== blob) throw new Error(`upstream blob mismatch: ${path}: ${actual}`);
  }
  execFileSync('npm', ['pack', 'kysely-d1@0.4.0', '--cache', join(directory, 'npm-cache'), '--pack-destination', directory], { stdio: 'pipe' });
  if (createHash('sha1').update(await readFile(join(directory, 'kysely-d1-0.4.0.tgz'))).digest('hex') !== '3122753e3d3d1d00d118ff756a329ae2318b1589') {
    throw new Error('kysely-d1 tarball mismatch');
  }
  execFileSync('tar', ['-xzf', join(directory, 'kysely-d1-0.4.0.tgz'), '-C', directory]);
  await symlink(join(root, 'node_modules'), join(directory, 'node_modules'));

  // Fixture dependencies throw if reached. No implementation method is extracted/replaced.
  // Scalar expandCollectionBlockFields returns before its unrelated block/Zod dependencies.
  const registryPath = join(directory, 'packages/core/src/schema/registry.ts');
  const blockValuesPath = join(directory, 'packages/core/src/schema/block-values.ts');
  const fixtureModules = new Map();
  const importerFixtures = new Map();
  for (const [importer, realImports] of [
    [registryPath, new Set(['kysely', 'ulidx', '../utils/chunks.js', './types.js', './url-pattern.js'])],
    [blockValuesPath, new Set(['ulidx', './registry.js'])]
  ]) {
    const source = await readFile(importer, 'utf8');
    const ast = ts.createSourceFile(importer, source, ts.ScriptTarget.Latest, true);
    const dependencies = new Map();
    for (const statement of ast.statements) {
      if (!ts.isImportDeclaration(statement) || statement.importClause?.isTypeOnly) continue;
      const path = statement.moduleSpecifier.text;
      if (realImports.has(path)) continue;
      const elements = statement.importClause?.namedBindings?.elements ?? [];
      const names = elements.filter(element => !element.isTypeOnly).map(element => element.propertyName?.text ?? element.name.text);
      if (!names.length) continue;
      const id = `\0manifest-fixture:${importer}:${path}`;
      const boundary = `${path}:${names.join(',')}`;
      dependencies.set(path, id);
      fixtureModules.set(id, {
        boundary,
        code: names.map(name => `export function ${name}() { throw new Error(${JSON.stringify(`outside scalar manifest fixture: ${boundary}`)}); }`).join('\n')
      });
    }
    importerFixtures.set(importer, dependencies);
  }

  // Execute the selected source assertion text unchanged, with Node assertion matchers.
  const sourceTestPath = join(directory, 'packages/core/tests/unit/runtime/manifest-build.test.ts');
  const sourceTest = await readFile(sourceTestPath, 'utf8');
  const ast = ts.createSourceFile(sourceTestPath, sourceTest, ts.ScriptTarget.Latest, true);
  let outputStatements;
  function visit(node) {
    if (ts.isCallExpression(node) && node.arguments[0]?.text === 'includes field definitions for many collections in two queries flat') {
      const callback = node.arguments[1];
      if (!ts.isArrowFunction(callback) || !ts.isBlock(callback.body)) throw new Error('source fixture changed');
      outputStatements = callback.body.statements.slice(-2).map(statement => statement.getText(ast)).join('\n');
      if (ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1 !== 537) throw new Error('source assertion identity changed');
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  if (!outputStatements || (outputStatements.match(/expect\(/g) ?? []).length !== 2) throw new Error('source output assertions missing');

  await writeFile(join(directory, 'entry.ts'), `
import test from 'node:test'; import assert from 'node:assert/strict';
import { Kysely, SqliteDialect, sql } from 'kysely'; import { DatabaseSync } from 'node:sqlite';
import { Miniflare } from 'miniflare';
import { RawBindingD1Dialect } from './packages/cloudflare/src/db/d1-dialect.ts';
import { SchemaRegistry } from './packages/core/src/schema/registry.ts';
import { buildManifestCollections } from './packages/core/src/api/handlers/manifest.ts';
import { SQL_BATCH_SIZE } from './packages/core/src/utils/chunks.ts';
const target=process.env.CMS_UPSTREAM_TARGET;
function expect(value) { return {toEqual: expected=>assert.deepEqual(value,expected), toBe: expected=>assert.equal(value,expected)}; }

async function fixture(count) {
  let runtime; let native; const queries=[];
  if(target==='D1') runtime=new Miniflare({modules:true,script:'export default {fetch(){return new Response("fixture")}}',
    compatibilityDate:'2026-05-07',host:'127.0.0.1',port:0,cf:false,d1Databases:{DB:'upstream-manifest'}});
  else native=new DatabaseSync(':memory:');
  const db=new Kysely({log:event=>{if(event.level==='query') queries.push(event.query);},
    dialect:runtime ? new RawBindingD1Dialect({database:await runtime.getD1Database('DB')})
      : new SqliteDialect({database:{close:()=>native.close(),prepare(query){const statement=native.prepare(query);
        return {reader:statement.columns().length>0,all:parameters=>statement.all(...parameters),run:parameters=>statement.run(...parameters)};}}})});
  try {
    await sql\`CREATE TABLE _emdash_collections (
      id TEXT PRIMARY KEY, slug TEXT UNIQUE, label TEXT, label_singular TEXT, description TEXT,
      supports TEXT, source TEXT, created_at TEXT, updated_at TEXT, icon TEXT, admin_config TEXT,
      has_seo INTEGER, title_field TEXT, date_field TEXT, url_pattern TEXT, routable INTEGER,
      hidden INTEGER, sort_order INTEGER, nav_group TEXT, comments_enabled INTEGER,
      comments_moderation TEXT, comments_closed_after_days INTEGER, comments_auto_approve_users INTEGER, edit_locking INTEGER
    )\`.execute(db);
    await sql\`CREATE TABLE _emdash_fields (
      id TEXT PRIMARY KEY, collection_id TEXT, slug TEXT, label TEXT, type TEXT, column_type TEXT,
      required INTEGER, "unique" INTEGER, default_value TEXT, validation TEXT, widget TEXT, options TEXT,
      sort_order INTEGER, searchable INTEGER, indexed INTEGER, translatable INTEGER, created_at TEXT
    )\`.execute(db);
    async function collection(slug,label='Fixture') {await db.insertInto('_emdash_collections').values({
      id:slug,slug,label,label_singular:label,supports:'["drafts","revisions"]',source:'test',
      created_at:'2000-01-01T00:00:00.000Z',updated_at:'2000-01-01T00:00:00.000Z'
    }).execute();}
    async function field(collectionId,slug,sortOrder=0,createdAt='2000-01-01T00:00:00.000Z') {
      await db.insertInto('_emdash_fields').values({id:collectionId+'_'+slug,collection_id:collectionId,
        slug,label:slug==='title'?'Title':slug,type:'string',column_type:'TEXT',required:0,unique:0,
        sort_order:sortOrder,searchable:0,indexed:0,translatable:1,created_at:createdAt}).execute();
    }
    for(let i=0;i<count;i++){await collection('coll_'+i,'Coll '+i);await field('coll_'+i,'title');}
    queries.length=0;
    return {db,queries,collection,field,registry:new SchemaRegistry(db),async close(){await db.destroy();await runtime?.dispose();}};
  } catch(error) {await db.destroy();await runtime?.dispose();throw error;}
}
function verifyQueries(f,count) {
  assert.equal(SQL_BATCH_SIZE,50);
  assert.equal(f.queries.length,1+Math.ceil(count/50));
  assert.match(f.queries[0].sql,/from "_emdash_collections"/);
  for(const query of f.queries.slice(1)) {
    assert.match(query.sql,/from "_emdash_fields"/);
    assert.ok(query.parameters.length<=50);
  }
  assert.deepEqual(f.queries.slice(1).map(query=>query.parameters.length),
    count ? Array.from({length:Math.ceil(count/50)},(_,i)=>Math.min(50,count-i*50)) : []);
}
test(target+': source manifest-build.test.ts:537 six output assertions',async()=>{
  const f=await fixture(5);try {
    const manifest={collections:await buildManifestCollections({},f.db)};
    ${outputStatements}
  } finally {await f.close();}
});
for(const count of [0,1,50,51,100]) test(target+': supplemental actual source schema-read boundary '+count,async()=>{
  const f=await fixture(count);try {
    const collections=await f.registry.listCollectionsWithFields();
    assert.equal(collections.length,count);verifyQueries(f,count);
    assert.ok(collections.every(collection=>collection.fields.length===1 && collection.fields[0].slug==='title'));
    f.queries.length=0;
    const manifest=await buildManifestCollections({},f.db);
    assert.equal(Object.keys(manifest).length,count);verifyQueries(f,count);
    assert.ok(Object.values(manifest).every(collection=>collection.fields.title.kind==='string'));
    console.log(JSON.stringify({target,count,queryCount:f.queries.length,fieldQuerySizes:f.queries.slice(1).map(query=>query.parameters.length)}));
  } finally {await f.close();}
});
test(target+': supplemental scalar order, constructor omission and uncached reads',async()=>{
  const f=await fixture(0);try {
    await f.collection('zeta');await f.field('zeta','late',2);await f.field('zeta','early',0);
    await f.field('zeta','tie_after',1,'2000-01-02T00:00:00.000Z');
    await f.field('zeta','tie_before',1,'2000-01-01T00:00:00.000Z');
    await f.collection('alpha');await f.field('alpha','title');
    await f.collection('constructor');await f.field('constructor','title');
    await f.db.updateTable('_emdash_collections').set({sort_order:0}).where('slug','=','zeta').execute();
    const stored=await f.registry.listCollectionsWithFields();
    assert.deepEqual(stored.map(collection=>collection.slug),['zeta','alpha','constructor']);
    assert.deepEqual(stored[0].fields.map(field=>field.slug),['early','tie_before','tie_after','late']);
    const first=await buildManifestCollections({},f.db);
    assert.deepEqual(Object.keys(first),['zeta','alpha']);assert.equal(Object.hasOwn(first,'constructor'),false);
    assert.deepEqual(Object.keys(first.zeta.fields),['early','tie_before','tie_after','late']);
    await f.db.updateTable('_emdash_fields').set({label:'Changed'}).where('collection_id','=','alpha').execute();
    const second=await buildManifestCollections({},f.db);
    assert.equal(second.alpha.fields.title.label,'Changed');assert.equal(first.alpha.fields.title.label,'Title');
  } finally {await f.close();}
});
`);
  const output = join(directory, 'bundle.mjs');
  await build({ configFile: false, logLevel: 'error', plugins: [{
    name: 'bounded-scalar-manifest-fixture',
    resolveId(source, importer) {
      const fixture = importerFixtures.get(importer)?.get(source);
      if (fixture) return fixture;
      if (source === 'kysely-d1') return join(directory, 'package/dist/index.js');
      if (source === 'emdash/internal/database/migration-lock') return join(directory, 'packages/core/src/database/migration-lock.ts');
    },
    load(id) { return fixtureModules.get(id)?.code; }
  }], build: { target: 'node24', minify: false, outDir: directory, emptyOutDir: false,
    lib: { entry: join(directory, 'entry.ts'), formats: ['es'], fileName: () => 'bundle.mjs' },
    rollupOptions: { external: ['node:test', 'node:assert/strict', 'node:sqlite', 'kysely', 'kysely/migration', 'ulidx', 'miniflare'] }
  } });
  for (const target of ['Node', 'D1']) execFileSync(process.execPath, ['--test', output], {
    env: { ...process.env, CMS_UPSTREAM_TARGET: target }, stdio: 'inherit', timeout: 60000
  });
  console.log(JSON.stringify({pin,sources,fixtureBoundaries:[...fixtureModules.values()].map(value=>value.boundary),
    selectedSourceDeclarations:1,selectedSourceAssertionsPerTarget:6,supplementalTestsPerTarget:6,
    omissions:['full upstream suite','EmDashRuntime and requestCached','upstream migrations and createCollection/createField setup',
      'auth/disclosure and route composition','blocks/references/config/plugin/hash behavior','snapshot isolation','live D1 or hosted deployment']}));
} finally { await rm(directory, { recursive: true, force: true }); }
