// Executes the complete immutable upstream SchemaRegistry, not the CMS registry.
// Only unrelated dependency boundaries are replaced with throwing fixture modules;
// the source suite itself mocks refreshDevTypes. See docs/collection-update.md.
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
const directory = await mkdtemp(join(tmpdir(), 'cms-upstream-collection-update-'));
const sources = [
  ['packages/core/src/schema/registry.ts', 'da7bbcdda224dfca8d9146b2f36659ab90bcac2e'],
  ['packages/core/tests/unit/schema/registry.test.ts', '7e1413acd99071e888693021224a9644efa2a8c5'],
  ['packages/core/src/database/transaction.ts', '69bf167998a2fa9cc228c3612a69c8fde5ed85fe'],
  ['packages/cloudflare/src/db/d1-dialect.ts', 'b026d293554c5173e1447b5eff0d704e169d3384']
];
sources.push(...['packages/core/src/schema/types.ts', 'packages/core/src/schema/url-pattern.ts',
  'packages/cloudflare/src/db/d1-introspector.ts', 'packages/core/src/database/migration-lock.ts',
  'packages/core/src/database/pg-migration-lock.ts', 'packages/core/src/utils/db-errors.ts'].map(path => [path, null]));

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
  const registryPath = join(directory, 'packages/core/src/schema/registry.ts');
  const registrySource = await readFile(registryPath, 'utf8');
  const ast = ts.createSourceFile(registryPath, registrySource, ts.ScriptTarget.Latest, true);
  const realImports = new Set(['kysely', 'ulidx', '../database/transaction.js', './types.js', './url-pattern.js']);
  const fixtureModules = new Map();
  for (const statement of ast.statements) {
    if (!ts.isImportDeclaration(statement) || statement.importClause?.isTypeOnly) continue;
    const path = statement.moduleSpecifier.text;
    if (realImports.has(path)) continue;
    const elements = statement.importClause?.namedBindings?.elements ?? [];
    const names = elements.filter(element => !element.isTypeOnly).map(element => element.propertyName?.text ?? element.name.text);
    if (!names.length) continue;
    fixtureModules.set(path, names.map(name => path === '../astro/dev-typegen.js'
      ? `export function ${name}() {}`
      : `export function ${name}() { throw new Error(${JSON.stringify(`outside collection-update fixture: ${path}:${name}`)}); }`).join('\n'));
  }
  // Reuse the same selected assertion functions on both genuine implementations.
  const assertions = await readFile(join(root, 'tests/helpers/collection-update-contract.ts'), 'utf8');
  await writeFile(join(directory, 'assertions.ts'), assertions);
  await writeFile(join(directory, 'entry.ts'), `
import test from 'node:test'; import assert from 'node:assert/strict';
import { Kysely, SqliteDialect, sql } from 'kysely'; import { DatabaseSync } from 'node:sqlite';
import { Miniflare } from 'miniflare';
import { RawBindingD1Dialect } from './packages/cloudflare/src/db/d1-dialect.ts';
import { SchemaRegistry, SchemaError } from './packages/core/src/schema/registry.ts';
import { collectionUpdateCases } from './assertions.ts';

async function fixture(target) {
  let runtime; let native;
  if (target === 'D1') runtime = new Miniflare({modules:true,script:'export default {fetch(){return new Response("fixture")}}',
    compatibilityDate:'2026-05-07',host:'127.0.0.1',port:0,cf:false,d1Databases:{DB:'upstream-collections'}});
  else native = new DatabaseSync(':memory:');
  const db = new Kysely({dialect: runtime ? new RawBindingD1Dialect({database:await runtime.getD1Database('DB')})
    : new SqliteDialect({database:{close:()=>native.close(), prepare(query) {
      const statement=native.prepare(query);
      return {reader:statement.columns().length>0,all:parameters=>statement.all(...parameters),run:parameters=>statement.run(...parameters)};
    }}})});
  await sql\`CREATE TABLE _emdash_collections (
    id TEXT PRIMARY KEY, slug TEXT UNIQUE, label TEXT, label_singular TEXT, description TEXT,
    supports TEXT, source TEXT, created_at TEXT, updated_at TEXT, icon TEXT, admin_config TEXT,
    has_seo INTEGER, title_field TEXT, date_field TEXT, url_pattern TEXT, routable INTEGER,
    hidden INTEGER, sort_order INTEGER, nav_group TEXT, comments_enabled INTEGER,
    comments_moderation TEXT, comments_closed_after_days INTEGER, comments_auto_approve_users INTEGER, edit_locking INTEGER
  )\`.execute(db);
  const registry = new SchemaRegistry(db);
  return {db, registry, async close(){await db.destroy();await runtime?.dispose();},
    async seed(input){await db.insertInto('_emdash_collections').values({
      id:input.slug,slug:input.slug,label:input.label,label_singular:input.labelSingular??null,
      description:input.description??null,supports:JSON.stringify(input.supports??['drafts','revisions']),
      source:'manual',created_at:'2000-01-01T00:00:00.000Z',updated_at:'2000-01-01T00:00:00.000Z'
    }).execute();return registry.getCollection(input.slug);},
    update:(slug,input)=>registry.updateCollection(slug,input),error:SchemaError,
    async backdate(slug){await db.updateTable('_emdash_collections').set({updated_at:'2000-01-01T00:00:00.000Z'}).where('slug','=',slug).execute();}
  };
}
// withTransaction caches its capability process-wide. Each target gets a fresh process.
const target=process.env.CMS_UPSTREAM_TARGET;
for(const source of collectionUpdateCases) test(target+': upstream registry.test.ts:'+source.line+': '+source.title, async()=>{
  const f=await fixture(target);try{await source.run(f);}finally{await f.close();}
});
test(target+': upstream omissions/undefined/[]/singular label and no schema DDL', async()=>{
  const f=await fixture(target);try{
    await f.seed({slug:'posts',label:'Posts',labelSingular:'Post',description:'Original'});
    const objects=()=>sql\`SELECT name,sql FROM sqlite_master ORDER BY name\`.execute(f.db).then(result=>result.rows);
    const before=await objects();
    const updated=await f.update('posts',{labelSingular:'Article',description:'',supports:[]});
    assert.equal(updated.label,'Posts');assert.equal(updated.labelSingular,'Article');
    assert.equal(updated.description,'');assert.deepEqual(updated.supports,[]);
    const relabeled=await f.update('posts',{label:'Articles',labelSingular:undefined,description:undefined,supports:undefined});
    assert.equal(relabeled.label,'Articles');assert.equal(relabeled.labelSingular,'Article');
    assert.equal(relabeled.description,'');assert.deepEqual(relabeled.supports,[]);
    assert.deepEqual(await objects(),before);assert.equal(Object.hasOwn(relabeled,'version'),false);
  }finally{await f.close();}
});
test(target+': measured upstream empty label/whitespace and same-clock timestamp behavior',async t=>{
  const f=await fixture(target);try{
    await f.seed({slug:'posts',label:'Posts'});
    t.mock.timers.enable({apis:['Date'],now:1000});
    const a=await f.update('posts',{label:'  Blog  '});assert.equal(a.label,'  Blog  ');
    const b=await f.update('posts',{label:''});assert.equal(b.label,'');assert.equal(a.updatedAt,b.updatedAt);
  }finally{t.mock.timers.reset();await f.close();}
});
`);
  const output = join(directory, 'bundle.mjs');
  await build({ configFile: false, logLevel: 'error', plugins: [{
    name: 'bounded-registry-fixture',
    resolveId(source, importer) {
      if (importer === registryPath && fixtureModules.has(source)) return '\0collection-fixture:' + source;
      if (source === 'kysely-d1') return join(directory, 'package/dist/index.js');
      if (source === 'emdash/internal/database/migration-lock') return join(directory, 'packages/core/src/database/migration-lock.ts');
    },
    load(id) { if (id.startsWith('\0collection-fixture:')) return fixtureModules.get(id.slice('\0collection-fixture:'.length)); }
  }], build: { target: 'node24', minify: false, outDir: directory, emptyOutDir: false,
    lib: { entry: join(directory, 'entry.ts'), formats: ['es'], fileName: () => 'bundle.mjs' },
    rollupOptions: { external: ['node:test', 'node:assert/strict', 'node:sqlite', 'kysely', 'ulidx', 'miniflare'] }
  } });
  for (const target of ['Node', 'D1']) execFileSync(process.execPath, ['--test', output], {
    env: { ...process.env, CMS_UPSTREAM_TARGET: target }, stdio: 'inherit'
  });
  console.log(JSON.stringify({ pin, sources: sources.filter(([, blob]) => blob),
    fixtureBoundaries: [...fixtureModules.keys()], selectedCases: 6, supplementalCases: 4 }));
} finally { await rm(directory, { recursive: true, force: true }); }
