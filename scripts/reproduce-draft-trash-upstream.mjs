// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// Execute the complete immutable ContentRepository and content handler modules.
// The fixtures seed draft rows directly; this is not published/revision or browser parity.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile, appendFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import ts from 'typescript';
import { trashPaginationEntry } from './reproduce-trash-pagination-upstream.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const pin = '913cb1bb9b7f08c3ff0d258b4420e53835b6a58e';
const directory = await mkdtemp(join(tmpdir(), 'cms-upstream-draft-trash-'));
const content = 'packages/core/src/database/repositories/content.ts';
const handlers = 'packages/core/src/api/handlers/content.ts';
const sources = [
  [content, '29dab9decf9af0d9fb21b464dc185ed48ab958ea'],
  [handlers, '34c2528c51a54119cd1730e876d699319c9f3702'],
  ['packages/core/tests/integration/content/trash-locale-filter.test.ts', '49f5ea1a533750f2c1a6b7bf78d12c468030c6e6'],
  ['e2e/tests/content-actions.spec.ts', '5bd09285048508d8c66d0e53761f32ea97f27a3c'],
  ['packages/core/src/database/transaction.ts', '69bf167998a2fa9cc228c3612a69c8fde5ed85fe'],
  ['packages/cloudflare/src/db/d1-dialect.ts', 'b026d293554c5173e1447b5eff0d704e169d3384']
];
const pagination = process.argv.includes('--pagination');
if (pagination) sources.push([
  'packages/core/tests/unit/database/repositories/cursor.test.ts',
  '119add8308e15decbe8dbf148f7433fb8b12312f'
]);
sources.push(...[
  'database/repositories/types.ts', 'database/content-datetime.ts', 'database/validate.ts',
  'object-cache/index.ts', 'object-cache/codec.ts', 'after.ts', 'deferred-tasks.ts',
  'request-context.ts', 'api/rev.ts', 'utils/base64.ts', 'utils/db-errors.ts',
  'database/migration-lock.ts', 'database/pg-migration-lock.ts'
].map(path => ['packages/core/src/' + path, null]));
sources.push(['packages/cloudflare/src/db/d1-introspector.ts', null]);
if (pagination) {
  // The optional cursor probe verifies the complete unchanged helper modules,
  // as well as the test blob, before building the temporary fixture.
  sources.find(([path]) => path === 'packages/core/src/database/repositories/types.ts')[1] =
    'abcf7a35f71936c2e8953f7bbd18b32fa1282bb7';
  sources.find(([path]) => path === 'packages/core/src/utils/base64.ts')[1] =
    '9dae6dade270b1c1291b21c8a90adc73f5dab294';
}
const fixtureModules = new Map();
const realImports = new Map([
  [content, new Set(['kysely', 'ulidx', '../../object-cache/index.js',
    '../content-datetime.js', '../validate.js', './types.js', '../../utils/db-errors.js'])],
  [handlers, new Set(['kysely', '../../database/repositories/content.js',
    '../../database/repositories/types.js', '../../database/transaction.js',
    '../../utils/db-errors.js', '../rev.js'])],
  ['packages/core/src/database/content-datetime.ts', new Set(['./repositories/types.js'])]
]);

try {
  const sourceBlobs = [];
  for (const [path, blob] of sources) {
    const destination = join(directory, path);
    await mkdir(dirname(destination), { recursive: true });
    if (process.env.CMS_EMDASH_REPOSITORY) {
      await writeFile(destination, execFileSync('git', ['-C', process.env.CMS_EMDASH_REPOSITORY,
        'show', `${pin}:${path}`]));
    } else {
      execFileSync('curl', ['-fsSL', `https://raw.githubusercontent.com/emdash-cms/emdash/${pin}/${path}`, '-o', destination]);
    }
    const bytes = await readFile(destination);
    const actual = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
    if (blob && actual !== blob) throw new Error(`upstream blob mismatch: ${path}: ${actual}`);
    sourceBlobs.push([path, actual]);
    if (!realImports.has(path)) continue;
    const ast = ts.createSourceFile(path, bytes.toString(), ts.ScriptTarget.Latest, true);
    for (const statement of ast.statements) {
      if (!ts.isImportDeclaration(statement) || statement.importClause?.isTypeOnly) continue;
      const source = statement.moduleSpecifier.text;
      if (realImports.get(path).has(source)) continue;
      const names = (statement.importClause?.namedBindings?.elements ?? [])
        .filter(element => !element.isTypeOnly)
        .map(element => element.propertyName?.text ?? element.name.text);
      if (!names.length) continue;
      const key = `${path}:${source}`;
      fixtureModules.set(key, names.map(name =>
        `export function ${name}() { throw new Error(${JSON.stringify(`outside draft-trash fixture: ${key}:${name}`)}); }`
      ).join('\n'));
    }
  }
  // Use the same upstream D1 dialect/dependency as the collection reproduction.
  execFileSync('npm', ['pack', 'kysely-d1@0.4.0', '--cache', join(directory, 'npm-cache'), '--pack-destination', directory], { stdio: 'pipe' });
  if (createHash('sha1').update(await readFile(join(directory, 'kysely-d1-0.4.0.tgz'))).digest('hex') !== '3122753e3d3d1d00d118ff756a329ae2318b1589') throw new Error('kysely-d1 tarball mismatch');
  execFileSync('tar', ['-xzf', join(directory, 'kysely-d1-0.4.0.tgz'), '-C', directory]);
  await symlink(join(root, 'node_modules'), join(directory, 'node_modules'));
  await writeFile(join(directory, 'entry.ts'), `
import test from 'node:test'; import assert from 'node:assert/strict';
import { Kysely, SqliteDialect, sql } from 'kysely'; import { DatabaseSync } from 'node:sqlite';
import { Miniflare } from 'miniflare';
import { RawBindingD1Dialect } from './packages/cloudflare/src/db/d1-dialect.ts';
import { ContentRepository } from './packages/core/src/database/repositories/content.ts';
import { ContentMutationConflictError } from './packages/core/src/database/repositories/types.ts';
import { handleContentListTrashed, handleContentRestore } from './packages/core/src/api/handlers/content.ts';
import { encodeRev, decodeRev } from './packages/core/src/api/rev.ts';
import { waitForDeferredTasks } from './packages/core/src/deferred-tasks.ts';

const target=process.env.CMS_UPSTREAM_TARGET;
async function fixture() {
  let runtime; let native;
  if(target==='D1') runtime=new Miniflare({modules:true,
    script:'export default {fetch(){return new Response("fixture")}}',
    compatibilityDate:'2026-05-07',host:'127.0.0.1',port:0,cf:false,d1Databases:{DB:'upstream-trash'}});
  else native=new DatabaseSync(':memory:');
  const db=new Kysely({dialect:runtime
    ? new RawBindingD1Dialect({database:await runtime.getD1Database('DB')})
    : new SqliteDialect({database:{close:()=>native.close(),prepare(query){
      const statement=native.prepare(query);
      return {reader:statement.columns().length>0,all:parameters=>statement.all(...parameters),
        run:parameters=>statement.run(...parameters)};
    }}})});
  // Only a draft physical collection. No revision table, published fixture,
  // schema-registry invocation, authorization transport, or browser interaction.
  await sql\`CREATE TABLE ec_posts (
    id TEXT PRIMARY KEY, slug TEXT, status TEXT NOT NULL DEFAULT 'draft', author_id TEXT,
    primary_byline_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
    published_at TEXT, scheduled_at TEXT, live_revision_id TEXT, draft_revision_id TEXT,
    version INTEGER NOT NULL DEFAULT 1, locale TEXT, translation_group TEXT,
    deleted_at TEXT, title TEXT, body TEXT
  )\`.execute(db);
  const repo=new ContentRepository(db);
  return {db,repo,async close(){await waitForDeferredTasks();await db.destroy();await runtime?.dispose();},
    async seed(id,locale='en',slug=id,deletedAt='2026-01-01T00:00:00.000Z'){
      await db.insertInto('ec_posts').values({id,slug,status:'draft',author_id:'owner',
        created_at:'2025-01-01T00:00:00.000Z',updated_at:'2025-01-02T00:00:00.000Z',version:4,
        locale,translation_group:'group-'+id,deleted_at:deletedAt,title:'Title '+id,body:'Retained body '+id}).execute();
      return repo.findByIdIncludingTrashed('posts',id);
    }};
}

// Source cases retain both assertion leaves each; setup is adapted to seeded drafts.
for(const source of [
  {line:57,title:'lists only the trashed entries in the requested locale',options:{locale:'fr'},
    check:result=>assert.deepEqual(result.data.items.map(item=>item.slug),['hello-fr'])},
  {line:65,title:'lists every locale when no locale is given',options:{},
    check:result=>assert.deepEqual(new Set(result.data.items.map(item=>item.slug)),new Set(['hello-en','hello-fr','hallo-de']))},
  {line:75,title:"returns each item's locale so the trash list can display it",options:{locale:'de'},
    check:result=>assert.equal(result.data.items[0]?.locale,'de')}
]) test(target+': upstream trash-locale-filter.test.ts:'+source.line+': '+source.title,async()=>{
  const f=await fixture();try{
    await f.seed('en','en','hello-en');await f.seed('fr','fr','hello-fr');await f.seed('de','de','hallo-de');
    const result=await handleContentListTrashed(f.db,'posts',source.options);
    assert.equal(result.success,true);if(!result.success)return;source.check(result);
  }finally{await f.close();}
});

test(target+': supplemental active-row CONFLICT and handler missing-row NOT_FOUND',async()=>{
  const f=await fixture();try{
    const row=await f.seed('active','en','active',null);
    const before=await sql\`SELECT * FROM ec_posts WHERE id='active'\`.execute(f.db);
    const active=await handleContentRestore(f.db,'posts',row.id,{_rev:encodeRev(row)});
    assert.equal(active.success,false);assert.equal(active.error.code,'CONFLICT');
    assert.deepEqual((await sql\`SELECT * FROM ec_posts WHERE id='active'\`.execute(f.db)).rows,before.rows);
    const missing=await handleContentRestore(f.db,'posts','missing');
    assert.equal(missing.success,false);assert.equal(missing.error.code,'NOT_FOUND');
  }finally{await f.close();}
});

test(target+': supplemental retained draft row, data, owner, locale and refreshed revision',async()=>{
  const f=await fixture();try{
    const row=await f.seed('retained','fr');
    assert.equal(await f.repo.findById('posts',row.id),null);
    const result=await handleContentRestore(f.db,'posts',row.id,{_rev:encodeRev(row)});
    assert.equal(result.success,true);assert.equal(result.data.restored,true);
    const restored=result.data.item;
    for(const key of ['id','slug','authorId','locale','translationGroup','createdAt']) assert.equal(restored[key],row[key]);
    assert.deepEqual(restored.data,row.data);assert.equal(restored.status,'draft');
    assert.equal(restored.version,row.version+1);assert.notEqual(result.data._rev,encodeRev(row));
    assert.deepEqual(decodeRev(result.data._rev),{version:restored.version,updatedAt:restored.updatedAt});
    assert.equal((await f.repo.findByIdIncludingTrashed('posts',row.id)).deletedAt,null);
    assert.deepEqual((await f.repo.findTrashed('posts')).items,[]);
  }finally{await f.close();}
});

test(target+': supplemental trash default 50, cap 100, deleted_at DESC / id DESC and active exclusion',async()=>{
  const f=await fixture();try{
    for(let index=0;index<105;index++) await f.seed(String(index).padStart(3,'0'),index%2?'fr':'de');
    await f.seed('latest','en','latest','2026-02-01T00:00:00.000Z');
    await f.seed('active','en','active',null);
    const first=await handleContentListTrashed(f.db,'posts',{});
    assert.equal(first.success,true);assert.equal(first.data.items.length,50);
    assert.deepEqual(first.data.items.map(item=>item.id),['latest',...Array.from({length:49},(_,i)=>String(104-i).padStart(3,'0'))]);
    assert.ok(first.data.nextCursor);
    const capped=await handleContentListTrashed(f.db,'posts',{limit:1000});
    assert.equal(capped.data.items.length,100);assert.ok(capped.data.nextCursor);
    assert.equal(capped.data.items.some(item=>item.id==='active'),false);
    assert.equal((await handleContentListTrashed(f.db,'posts',{limit:0})).data.items.length,50);
  }finally{await f.close();}
});

test(target+': supplemental stale preconditions and sequential double restore do not alter data',async()=>{
  const f=await fixture();try{
    const row=await f.seed('stale');
    for(const expected of [{...row,version:row.version-1},{...row,updatedAt:'2000-01-01T00:00:00.000Z'}]){
      const result=await handleContentRestore(f.db,'posts',row.id,{_rev:encodeRev(expected)});
      assert.equal(result.success,false);assert.equal(result.error.code,'CONFLICT');
      assert.deepEqual(await f.repo.findByIdIncludingTrashed('posts',row.id),row);
    }
    const first=await handleContentRestore(f.db,'posts',row.id,{_rev:encodeRev(row)});
    assert.equal(first.success,true);
    for(const _rev of [encodeRev(row),first.data._rev]){
      const second=await handleContentRestore(f.db,'posts',row.id,{_rev});
      assert.equal(second.success,false);assert.equal(second.error.code,'CONFLICT');
      assert.deepEqual(await f.repo.findById('posts',row.id),first.data.item);
    }
  }finally{await f.close();}
});

test(target+': supplemental concurrent repository restore CAS has one winner',async()=>{
  const f=await fixture();try{
    const row=await f.seed('racing');
    // Repository calls share this genuine runtime. Handler transactions are
    // separately covered above; this does not claim two-connection Node races.
    const outcomes=await Promise.allSettled([f.repo.restore('posts',row.id,row),f.repo.restore('posts',row.id,row)]);
    assert.equal(outcomes.filter(result=>result.status==='fulfilled').length,1);
    const loser=outcomes.find(result=>result.status==='rejected');
    assert.ok(loser.reason instanceof ContentMutationConflictError);
    const stored=await f.repo.findById('posts',row.id);
    assert.equal(stored.version,row.version+1);assert.deepEqual(stored.data,row.data);
  }finally{await f.close();}
});

test(target+': supplemental same-clock restore preserves upstream timestamp behavior',async t=>{
  const f=await fixture();try{
    const row=await f.seed('clock');
    t.mock.timers.enable({apis:['Date'],now:Date.parse(row.updatedAt)});
    const result=await handleContentRestore(f.db,'posts',row.id,{_rev:encodeRev(row)});
    assert.equal(result.success,true);assert.equal(result.data.item.updatedAt,row.updatedAt);
    assert.equal(result.data.item.version,row.version+1);
  }finally{t.mock.timers.reset();await f.close();}
});
`);
  if (pagination) await appendFile(join(directory, 'entry.ts'), trashPaginationEntry(
    await readFile(join(directory, 'packages/core/tests/unit/database/repositories/cursor.test.ts'), 'utf8')
  ));
  // The escaped template ticks above deliberately keep embedded SQL as source.
  const output = join(directory, 'bundle.mjs');
  await build({ configFile: false, logLevel: 'error', plugins: [{
    name: 'bounded-draft-trash-fixture',
    resolveId(source, importer) {
      if (source === 'virtual:emdash/object-cache' || source === 'virtual:emdash/wait-until') return '\0disabled:' + source;
      if (source === 'kysely-d1') return join(directory, 'package/dist/index.js');
      if (source === 'emdash/internal/database/migration-lock') return join(directory, 'packages/core/src/database/migration-lock.ts');
      if (!importer) return;
      const path = importer.slice(directory.length + 1);
      const key = `${path}:${source}`;
      if (fixtureModules.has(key)) return '\0draft-trash-fixture:' + key;
    },
    load(id) {
      if (id.startsWith('\0draft-trash-fixture:')) return fixtureModules.get(id.slice('\0draft-trash-fixture:'.length));
      if (id === '\0disabled:virtual:emdash/object-cache') return 'export const createObjectCache = undefined; export const objectCacheConfig = undefined;';
      if (id === '\0disabled:virtual:emdash/wait-until') return 'export const waitUntil = undefined;';
    }
  }], build: { target: 'node24', minify: false, outDir: directory, emptyOutDir: false,
    lib: { entry: join(directory, 'entry.ts'), formats: ['es'], fileName: () => 'bundle.mjs' },
    rollupOptions: { external: ['node:test', 'node:assert/strict', 'node:sqlite', 'node:async_hooks', 'kysely', 'ulidx', 'miniflare'] }
  } });
  // withTransaction caches dialect capability process-wide: isolate targets.
  for (const target of ['Node', 'D1']) execFileSync(process.execPath, ['--test', output], {
    env: { ...process.env, CMS_UPSTREAM_TARGET: target }, stdio: 'inherit'
  });
  console.log(JSON.stringify({ pin, sources: sourceBlobs, fixtureBoundaries: [...fixtureModules.keys()],
    disabledVirtualModules: ['virtual:emdash/object-cache', 'virtual:emdash/wait-until'],
    selectedSourceCasesPerRuntime: 3, selectedSourceAssertionsPerRuntime: 6,
    supplementalCasesPerRuntime: 6,
    ...(pagination ? {
      pagination: {
        sourceCursorDeclarationsPerRuntime: 8,
        sourceCursorAssertionExpressionsPerRuntime: 10,
        sourceCursorFailureGuardsPerRuntime: 1,
        sourceCursorDeclarationLines: [10, 16, 20, 24, 29, 34, 39, 49],
        supplementalPaginationCasesPerRuntime: 5,
        totalCasesPerRuntime: 22,
        utilityRuntime: 'Node host UTF-8/btoa/atob fallback in both adapter processes; not workerd utility execution',
        repositoryRuntime: 'Complete pinned repository/handler with real Node SQLite or local D1 storage'
      }
    } : {}),
    omissions: ['trash-locale-filter.test.ts:83 count (2 assertions)',
      'content-actions.spec.ts:629 entire browser case (0 credit)',
      'published/revision lifecycle', 'schema-registry fixture setup', 'production/deployed adapters',
      'two-connection upstream race, restart and rollback (local implementation supplements own those)'] }));
} finally { await rm(directory, { recursive: true, force: true }); }
