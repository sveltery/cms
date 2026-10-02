// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// Diagnostic only: complete immutable registry creates upstream indexes, and complete
// ContentRepository executes findTrashed. Local layouts are explicit SQL fixtures.
// Query-plan observations receive zero upstream assertion credit.
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
const directory = await mkdtemp(join(tmpdir(), 'cms-upstream-draft-trash-index-'));
const content = 'packages/core/src/database/repositories/content.ts';
const registry = 'packages/core/src/schema/registry.ts';
const sources = [
  [content, '29dab9decf9af0d9fb21b464dc185ed48ab958ea'],
  [registry, 'da7bbcdda224dfca8d9146b2f36659ab90bcac2e'],
  ['packages/core/src/database/transaction.ts', '69bf167998a2fa9cc228c3612a69c8fde5ed85fe'],
  ['packages/cloudflare/src/db/d1-dialect.ts', 'b026d293554c5173e1447b5eff0d704e169d3384']
];
sources.push(...[
  'database/repositories/types.ts', 'database/content-datetime.ts', 'database/validate.ts',
  'object-cache/index.ts', 'object-cache/codec.ts', 'after.ts', 'deferred-tasks.ts',
  'request-context.ts', 'api/rev.ts', 'utils/base64.ts', 'utils/db-errors.ts',
  'database/migration-lock.ts', 'database/pg-migration-lock.ts',
  'schema/types.ts', 'schema/url-pattern.ts', 'database/dialect-helpers.ts'
].map(path => ['packages/core/src/' + path, null]));
sources.push(['packages/cloudflare/src/db/d1-introspector.ts', null]);
const fixtureModules = new Map();
const realImports = new Map([
  [content, new Set(['kysely', 'ulidx', '../../object-cache/index.js',
    '../content-datetime.js', '../validate.js', './types.js', '../../utils/db-errors.js'])],
  [registry, new Set(['kysely', 'ulidx', '../database/transaction.js', './types.js',
    './url-pattern.js', '../database/dialect-helpers.js', '../database/validate.js'])],
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
      const registryOverrides = {
        refreshDevTypes: '() => {}', resetRegisteredCollectionsCache: '() => {}',
        finishMediaUsageCollectionDeletion: 'async () => ({ state: "complete" })',
        isMediaUsageCollectionSlugDeleting: 'async () => false',
        canResumeMediaUsageCollectionCapture: 'async () => false',
        findResumableMediaUsageCollectionCaptureId: 'async () => null',
        prepareMediaUsageCollectionCapture: 'async (_db, input) => ({ collectionId: input.collectionId, captureRequired: false })',
        invalidateContentMediaUsageSchemaChange: 'async () => false',
        markContentMediaUsageCollectionStaleSafely: 'async () => {}'
      };
      fixtureModules.set(key, names.map(name => path === registry && registryOverrides[name]
        ? `export const ${name} = ${registryOverrides[name]};`
        : `export function ${name}() { throw new Error(${JSON.stringify(`outside draft-trash-index fixture: ${key}:${name}`)}); }`
      ).join('\n'));
    }
  }
  // Use the same upstream D1 dialect/dependency as the collection reproduction.
  execFileSync('npm', ['pack', 'kysely-d1@0.4.0', '--cache', join(directory, 'npm-cache'), '--pack-destination', directory], { stdio: 'pipe' });
  if (createHash('sha1').update(await readFile(join(directory, 'kysely-d1-0.4.0.tgz'))).digest('hex') !== '3122753e3d3d1d00d118ff756a329ae2318b1589') throw new Error('kysely-d1 tarball mismatch');
  execFileSync('tar', ['-xzf', join(directory, 'kysely-d1-0.4.0.tgz'), '-C', directory]);
  await symlink(join(root, 'node_modules'), join(directory, 'node_modules'));
  await writeFile(join(directory, 'entry.ts'), `
import assert from 'node:assert/strict';
import { Kysely, SqliteDialect, sql, CompiledQuery } from 'kysely';
import { DatabaseSync } from 'node:sqlite'; import { Miniflare } from 'miniflare';
import { RawBindingD1Dialect } from './packages/cloudflare/src/db/d1-dialect.ts';
import { SchemaRegistry } from './packages/core/src/schema/registry.ts';
import { ContentRepository } from './packages/core/src/database/repositories/content.ts';
import { waitForDeferredTasks } from './packages/core/src/deferred-tasks.ts';
const target=process.env.CMS_UPSTREAM_TARGET;
let runtime; let native; const logged=[];
if(target==='D1') runtime=new Miniflare({modules:true,
  script:'export default {fetch(){return new Response("fixture")}}',
  compatibilityDate:'2026-05-07',host:'127.0.0.1',port:0,cf:false,d1Databases:{DB:'upstream-trash-index'}});
else native=new DatabaseSync(':memory:');
const db=new Kysely({log:event=>{if(event.level==='query')logged.push(event.query);},dialect:runtime
  ? new RawBindingD1Dialect({database:await runtime.getD1Database('DB')})
  : new SqliteDialect({database:{close:()=>native.close(),prepare(query){
    const statement=native.prepare(query);return {reader:statement.columns().length>0,
      all:parameters=>statement.all(...parameters),run:parameters=>statement.run(...parameters)};
  }}})});
try {
  // System metadata fixture only. Actual immutable registry creates ec_posts,
  // its scalar fields, and every upstream content-table index.
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
  const registry=new SchemaRegistry(db);
  await registry.createCollection({slug:'posts',label:'Posts',supports:['drafts']});
  await registry.createField('posts',{slug:'title',label:'Title',type:'string'});
  await registry.createField('posts',{slug:'body',label:'Body',type:'text'});
  const upstreamIndexes=(await sql\`SELECT name,sql FROM sqlite_master WHERE type='index' AND tbl_name='ec_posts' ORDER BY name\`.execute(db)).rows;
  // Original local physical layout before proposed trash-index changes. No
  // local registry execution, because the working implementation now adds one.
  await sql\`CREATE TABLE ec_local (
    id TEXT PRIMARY KEY NOT NULL, slug TEXT, status TEXT NOT NULL DEFAULT 'draft' CHECK(status='draft'),
    author_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, published_at TEXT,
    scheduled_at TEXT, deleted_at TEXT, version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
    live_revision_id TEXT, draft_revision_id TEXT, locale TEXT NOT NULL DEFAULT 'en',
    translation_group TEXT, title TEXT, body TEXT, UNIQUE(slug,locale)
  )\`.execute(db);
  await sql\`CREATE INDEX idx_ec_local_draft_list ON ec_local(locale,deleted_at,created_at,id)\`.execute(db);
  // Identical 300-row dataset: 200 active + 100 trashed, ten deletion timestamp
  // cohorts of ten rows. Distinct groups prevent translation uniqueness issues.
  const rows=Array.from({length:300},(_,index)=>({
    id:String(index).padStart(4,'0'),slug:'entry-'+index,status:'draft',author_id:'owner',
    created_at:'2025-01-01T00:00:00.000Z',updated_at:'2025-01-02T00:00:00.000Z',version:4,
    locale:['en','fr','de'][index%3],translation_group:'group-'+index,
    deleted_at:index<200?null:new Date(Date.UTC(2026,0,1+Math.floor((index-200)/10))).toISOString(),
    title:'Title '+index,body:'Retained body '+index
  }));
  for(const row of rows) {
    await db.insertInto('ec_posts').values(row).execute();
    await db.insertInto('ec_local').values(row).execute();
  }
  const repository=new ContentRepository(db);
  const result=await repository.findTrashed('posts');
  const upstreamQuery=logged.findLast(query=>query.sql.startsWith('select * from "ec_posts"'));
  assert.ok(upstreamQuery,'capture the actual immutable repository query');
  assert.equal(result.items.length,50);assert.ok(result.nextCursor);
  const localQuery=sql\`SELECT id, slug, status, author_id, locale, version, created_at,
    updated_at, deleted_at, substr(title,1,200) AS title FROM ec_local
    WHERE deleted_at IS NOT NULL AND status='draft' ORDER BY deleted_at DESC,id DESC LIMIT \${50}\`.compile(db);
  const explain=async query=>(await db.executeQuery(CompiledQuery.raw('EXPLAIN QUERY PLAN '+query.sql,query.parameters))).rows;
  const opcodes=async query=>(await db.executeQuery(CompiledQuery.raw('EXPLAIN '+query.sql,query.parameters))).rows
    .filter(row=>/Sort|Rewind|Seek|Next|Prev|IdxG|IdxL|DecrJumpZero/.test(row.opcode))
    .map(({addr,opcode,p1,p2,p3,p4,p5})=>({addr,opcode,p1,p2,p3,p4,p5}));
  const original=await db.executeQuery(localQuery);
  assert.deepEqual(original.rows.map(row=>row.id),result.items.map(row=>row.id));
  const record={target,dataset:{total:300,active:200,trashed:100,deletionTimestampCohorts:10,rowsPerCohort:10},
    analyzed:false,upstreamIndexes,
    upstream:{query:{sql:upstreamQuery.sql,parameters:upstreamQuery.parameters},plan:await explain(upstreamQuery),sortScanOpcodes:await opcodes(upstreamQuery)},
    originalLocal:{query:{sql:localQuery.sql,parameters:localQuery.parameters},plan:await explain(localQuery),sortScanOpcodes:await opcodes(localQuery)}};
  // Candidate minimal deleted-leading adaptation follows an existing upstream
  // index, preserving the remainder sort rather than claiming full-order parity.
  await sql\`CREATE INDEX idx_ec_local_deleted_created_id ON ec_local(deleted_at,created_at DESC,id DESC)\`.execute(db);
  record.localWithUpstreamComposite={plan:await explain(localQuery),sortScanOpcodes:await opcodes(localQuery)};
  await sql\`DROP INDEX idx_ec_local_deleted_created_id\`.execute(db);
  // Also reproduce the exact index the stock upstream planner selected above.
  await sql\`CREATE INDEX idx_ec_local_deleted_status ON ec_local(deleted_at,status)\`.execute(db);
  record.localWithUpstreamDeletedStatus={plan:await explain(localQuery),sortScanOpcodes:await opcodes(localQuery)};
  await sql\`DROP INDEX idx_ec_local_deleted_status\`.execute(db);
  // Proposed partial index is independently measured; it is not an upstream
  // registry index and does not earn source or index-layout parity credit.
  await sql\`CREATE INDEX idx_ec_local_trash ON ec_local(deleted_at DESC,id DESC)
    WHERE deleted_at IS NOT NULL AND status='draft'\`.execute(db);
  record.proposedPartial={definition:(await sql\`SELECT sql FROM sqlite_master WHERE name='idx_ec_local_trash'\`.execute(db)).rows[0].sql,
    plan:await explain(localQuery),sortScanOpcodes:await opcodes(localQuery)};
  assert.deepEqual((await db.executeQuery(localQuery)).rows,original.rows);
  // Planner statistics can change choices. Keep the stock, unanalysed facts
  // above separate from this deliberately analysed supplemental comparison.
  await sql\`ANALYZE\`.execute(db);
  record.afterAnalyze={upstream:await explain(upstreamQuery),proposedPartial:await explain(localQuery)};
  await sql\`DROP INDEX idx_ec_local_trash\`.execute(db);
  record.afterAnalyze.originalLocal=await explain(localQuery);
  console.log(JSON.stringify(record));
} finally {await waitForDeferredTasks();await db.destroy();await runtime?.dispose();}
`);
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
  for (const target of ['Node', 'D1']) execFileSync(process.execPath, [output], {
    env: { ...process.env, CMS_UPSTREAM_TARGET: target }, stdio: 'inherit'
  });
  console.log(JSON.stringify({ pin, sources: sourceBlobs, fixtureBoundaries: [...fixtureModules.keys()],
    sourceAssertionCredit: 0, probesPerRuntime: 1,
    limits: ['explicit local SQL layout fixture rather than local service execution',
      'media lifecycle/typegen/cache fixture boundaries', 'draft-only dataset',
      'query-plan/opcode observations, not VM step counts or elapsed-time benchmarks',
      'local Miniflare D1, not deployed D1'] }));
} finally { await rm(directory, { recursive: true, force: true }); }
