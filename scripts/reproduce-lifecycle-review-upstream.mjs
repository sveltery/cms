// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// Complete pinned runtime methods, API handlers and repositories; bounded
// scalar/no-plugin/no-SEO fixture. This diagnostic earns no new parity credit.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtemp,mkdir,writeFile,readFile,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {build} from 'vite';
import ts from 'typescript';

const pin='913cb1bb9b7f08c3ff0d258b4420e53835b6a58e';
const upstream=process.argv[2];
if(!upstream)throw new Error('Usage: node scripts/reproduce-lifecycle-review-upstream.mjs /path/to/pinned-emdash-clone');
const root=fileURLToPath(new URL('../',import.meta.url));
const directory=await mkdtemp(join(tmpdir(),'cms-lifecycle-review-source-'));
const authority=[];
function source(path,expected) {
  const blob=execFileSync('git',['rev-parse',`${pin}:${path}`],{cwd:upstream,encoding:'utf8'}).trim();
  if(expected)assert.equal(blob,expected,path);
  authority.push({path,blob});
  return execFileSync('git',['show',`${pin}:${path}`],{cwd:upstream,encoding:'utf8'});
}
async function put(path,contents){const destination=join(directory,path);await mkdir(dirname(destination),{recursive:true});await writeFile(destination,contents);}
function declaration(text,name,method=false) {
  const ast=ts.createSourceFile('source.ts',text,ts.ScriptTarget.Latest,true);let found;
  function visit(node){if(node.name?.getText(ast)===name&&(method?ts.isMethodDeclaration(node):ts.isFunctionDeclaration(node)||ts.isVariableStatement(node.parent?.parent)))found=node;ts.forEachChild(node,visit);}
  visit(ast);if(!found)throw new Error(`Missing complete declaration: ${name}`);
  if(ts.isVariableDeclaration(found))return found.parent.parent.getText(ast);
  return found.getText(ast);
}
try {
  const ledger=JSON.parse(await readFile(join(root,'docs/lifecycle-source-files.json'),'utf8'));
  for(const item of ledger.files.filter(item=>!item.hostSubstitution))await put(item.path,source(item.path,item.blob));
  const extra=['packages/core/src/schema/types.ts','packages/core/src/schema/zod-generator.ts','packages/core/src/utils/hash.ts','packages/core/src/api/handlers/validation.ts','packages/core/src/request-cache.ts',
    'packages/core/src/api/schemas/content.ts','packages/core/src/api/schemas/common.ts','packages/core/src/api/schemas/bylines.ts','packages/core/src/api/schemas/relations.ts','packages/core/src/i18n/config.ts',
    'packages/core/src/api/parse.ts','packages/core/src/api/error.ts','packages/core/src/api/errors.ts','packages/core/src/api/authorize.ts','packages/core/src/transfer/errors.ts',
    'packages/auth/src/rbac.ts','packages/auth/src/types.ts','packages/core/src/astro/routes/api/content/[collection]/[id].ts'];
  for(const path of extra)await put(path,source(path));
  // No configured cache or request context is part of this fixture.
  await put('packages/core/src/object-cache/index.ts','export function invalidateCollectionCache() {}');
  await put('packages/core/src/request-context.ts','export function getRequestContext() {return undefined;}');
  // No entry lock is installed in this selected-route fixture; lock semantics
  // and all source authentication middleware are outside its assertion scope.
  await put('fixture-entry-lock.ts','export async function claimEntryLockForWrite(){return null;}');
  await put('fixture-auth.ts',`export * from './packages/auth/src/rbac.js'; ${declaration(source('packages/auth/src/tokens.ts'),'hasScope')}`);
  // The host's registered scalar schema supplies the same field definitions;
  // the complete original validation and Zod generator run on those definitions.
  await put('packages/core/src/schema/registry.ts',`export class SchemaRegistry {constructor(db){this.db=db;}getCollectionWithFields(type){return globalThis.__lifecycleReviewRegistries.get(this.db).getCollectionWithFields(type);}}`);
  const runtime=source('packages/core/src/emdash-runtime.ts','055ed1307ba4029e120cad989bc9b0e8c2d72afe');
  const api=source('packages/core/src/api/handlers/content.ts');
  const cleanup=source('packages/core/src/cleanup.ts');
  const helpers=['hasApiError','decodeRevisionPrecondition','collectionHasSeo','resolveId','handleContentUpdate','handleContentUnpublish'].map(name=>declaration(api,name)).join('\n');
  const methods=['handleContentUpdate','hydrateDraftData','normalizeFieldValues','dropUnknownKeysAlreadyStored','handleContentUnpublish'].map(name=>declaration(runtime,name,true)).join('\n');
  const constants=['DRAFT_ONLY_UPDATE_KEYS','ARRAY_FIELD_TYPES','MAX_DRAFT_STAGE_ATTEMPTS'].map(name=>declaration(runtime,name)).join('\n');
  await put('packages/core/src/review-runtime.ts',`
import assert from 'node:assert/strict';
import {ContentRepository} from './database/repositories/content.js';
import {RevisionRepository} from './database/repositories/revision.js';
import {ContentMutationConflictError,EmDashValidationError} from './database/repositories/types.js';
import {withTransaction} from './database/transaction.js';
import {isMissingTableError} from './utils/db-errors.js';
import {keepKnownFields,staleStoredKeys} from './content/known-fields.js';
import {isStoragelessField} from './schema/types.js';
import {encodeRev,decodeRev,validateRev} from './api/rev.js';
import {requestCached} from './request-cache.js';
const after=task=>globalThis.__lifecycleReviewAfter.push(task);
const SchemaError=class extends Error {};
const changedStoragelessDataKeys=(fields,data)=>{assert.equal(fields.size,0);return [];};
const normalizeBlocksData=async(_db,collection,data)=>{assert.equal(collection.fields.some(field=>field.type==='blocks'),false);return data;};
const markContentMediaUsageCollectionStale=async()=>{};
const contentItemToRecord=item=>item;
const isI18nEnabled=()=>false;
const resolveConfiguredLocale=locale=>locale;
const BylineRepository=class {constructor(){}};
const hydrateBylines=async()=>{};
const hydrateSeo=async(_db,_collection,_item,hasSeo)=>assert.equal(hasSeo,false);
${constants}
${helpers}
const REVISION_KEEP_COUNT=50;
const REVISION_PRUNE_BATCH_SIZE=10;
export ${declaration(cleanup,'pruneQueuedRevisions')}
export {ContentRepository,RevisionRepository,handleContentUpdate as apiUpdate};
export class SourceRuntime {
  constructor(db,schemaRegistry){this.db=db;this.schemaRegistry=schemaRegistry;this.hooks={hasHooks:()=>false};}
  async refreshContentUsageAfterSuccessfulWrite(){}
  runAfterSaveHooks(){}
  runAfterUnpublishHooks(){}
  async checkContentPolicy(_hook,type,id){const item=await new ContentRepository(this.db).findById(type,id);return {allowed:true,revision:encodeRev(item)};}
  ${methods}
}
`);
  await symlink(join(root,'node_modules'),join(directory,'node_modules'));
  await put('probe.ts',`
import assert from 'node:assert/strict';
import {sql,OperationNodeTransformer} from 'kysely';
import {schemaAdminStorage} from '${join(root,'tests/helpers/schema-admin-storage.ts')}';
import {migrateCms} from '${join(root,'src/lib/server/database/migrations.ts')}';
import {SchemaRegistry} from '${join(root,'src/lib/server/database/registry.ts')}';
import {SourceRuntime,ContentRepository,RevisionRepository,apiUpdate,pruneQueuedRevisions} from './packages/core/src/review-runtime.ts';
import {PUT} from './packages/core/src/astro/routes/api/content/[collection]/[id].ts';
class Namespace extends OperationNodeTransformer {
  transformIdentifier(node){return {...node,name:node.name==='revisions'?'_cms_revisions':node.name.replace(/^_emdash_/,'_cms_')};}
  transformRaw(node){return {...super.transformRaw(node),sqlFragments:node.sqlFragments.map(part=>part.replaceAll('_emdash_','_cms_').replace(/\\brevisions\\b/g,'_cms_revisions'))};}
}
const storage=await schemaAdminStorage('Node');
try {
  await migrateCms(storage.database);const registry=new SchemaRegistry(storage.database);
  await registry.createCollection({slug:'post',label:'Posts'});
  await registry.createField('post',{slug:'title',label:'Title',type:'string'});
  // Only the source options/timezone lookup needs a fixture absent from current
  // approved native settings. Empty table selects the original UTC default.
  await sql\x60CREATE TABLE options(name TEXT PRIMARY KEY,value TEXT)\x60.execute(storage.database.db);
  const transformer=new Namespace();const db=storage.database.db.withPlugin({transformQuery:({node})=>transformer.transformNode(node),transformResult:async({result})=>result});
  globalThis.__lifecycleReviewRegistries=new WeakMap([[db,registry]]);globalThis.__lifecycleReviewAfter=[];
  const content=new ContentRepository(db);const revisions=new RevisionRepository(db);const runtime=new SourceRuntime(db,registry);
  const created=await content.create({type:'post',slug:'mixed',locale:'en',data:{title:'Live'}});
  const published=await content.publish('post',created.id);
  const before=await content.findById('post',created.id);
  const result=await runtime.handleContentUpdate('post',created.id,{data:{title:'Rejected draft'},publishedAt:'not-a-date'});
  assert.equal(result.success,false);assert.equal(result.error.code,'VALIDATION_ERROR');
  const after=await content.findById('post',created.id);const draft=await revisions.findById(after.draftRevisionId);
  assert.equal(after.version,before.version+1);assert.notEqual(after.draftRevisionId,before.draftRevisionId);
  assert.equal(draft.data.title,'Rejected draft');assert.equal(after.data.title,'Live');assert.equal(after.publishedAt,before.publishedAt);
  const apiBefore=await content.findById('post',created.id);
  const apiResult=await apiUpdate(db,'post',created.id,{publishedAt:'not-a-date'});
  assert.equal(apiResult.success,false);assert.equal(apiResult.error.code,'VALIDATION_ERROR');
  assert.deepEqual(await content.findById('post',created.id),apiBefore);
  runtime.handleContentGet=async(type,id)=>runtime.hydrateDraftData({success:true,data:{item:await content.findById(type,id)}});
  const invokePut=body=>PUT({params:{collection:'post',id:created.id},request:new Request('https://source.example/_emdash/api/content/post/'+created.id,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(body)}),locals:{emdash:runtime,user:{id:'review-admin',role:50}},cache:{enabled:false}});
  const invalidBefore=await content.findById('post',created.id);
  const invalidPublic=await invokePut({data:{title:'Invalid REST input'},publishedAt:'not-a-date'});
  assert.equal(invalidPublic.status,400);assert.equal((await invalidPublic.json()).error.code,'VALIDATION_ERROR');
  assert.deepEqual(await content.findById('post',created.id),invalidBefore);
  // Real storage fault occurs only during the live metadata SQL statement.
  // Draft staging uses updated_at and therefore cannot trip this trigger.
  await sql\x60CREATE TRIGGER review_metadata_fault BEFORE UPDATE OF published_at ON ec_post WHEN NEW.published_at='2020-01-01T00:00:00.000Z' BEGIN SELECT RAISE(ABORT,'review metadata fault'); END\x60.execute(storage.database.db);
  const publicBefore=await content.findById('post',created.id);
  const publicFault=await invokePut({data:{title:'Accepted REST draft'},publishedAt:'2020-01-01T00:00:00.000Z'});
  assert.equal(publicFault.status,500);assert.equal((await publicFault.json()).error.code,'CONTENT_UPDATE_ERROR');
  const publicAfter=await content.findById('post',created.id);
  assert.equal(publicAfter.version,publicBefore.version+1);assert.notEqual(publicAfter.draftRevisionId,publicBefore.draftRevisionId);
  assert.equal((await revisions.findById(publicAfter.draftRevisionId)).data.title,'Accepted REST draft');
  assert.equal(publicAfter.publishedAt,publicBefore.publishedAt);assert.equal(publicAfter.data.title,'Live');
  await sql\x60DROP TRIGGER review_metadata_fault\x60.execute(storage.database.db);
  for(const task of globalThis.__lifecycleReviewAfter.splice(0))await task();
  await content.discardDraft('post',created.id);
  // Repeated source unpublish/republish writes queue new revision snapshots.
  for(let index=0;index<55;index++) {
    const unpublished=await runtime.handleContentUnpublish('post',created.id);assert.equal(unpublished.success,true);
    await content.publish('post',created.id);
  }
  const count=async()=>Number((await db.selectFrom('revisions').select(eb=>eb.fn.countAll().as('n')).where('entry_id','=',created.id).executeTakeFirst()).n);
  const beforeCleanup=await count();assert.ok(beforeCleanup>50);
  const queued=await db.selectFrom('_emdash_revision_prune_queue').selectAll().execute();assert.equal(queued.length,1);
  const pruned=await pruneQueuedRevisions(db);assert.ok(pruned>0);assert.equal(await count(),50);
  assert.deepEqual(await db.selectFrom('_emdash_revision_prune_queue').selectAll().execute(),[]);
  const current=await content.findById('post',created.id);assert.ok(await revisions.findById(current.liveRevisionId));
  const orderedEntries=[];
  for(let index=0;index<11;index++) {
    const entry=await content.create({type:'post',slug:'queue-'+index,locale:'en',data:{title:'Queue '+index}});
    const revision=await revisions.create({collection:'post',entryId:entry.id,data:{title:'Queue '+index}});
    orderedEntries.push({entryId:entry.id,revisionId:revision.id});
  }
  await pruneQueuedRevisions(db);
  const remaining=await db.selectFrom('_emdash_revision_prune_queue').selectAll().execute();
  assert.equal(remaining.length,1);assert.equal(remaining[0].entry_id,orderedEntries[10].entryId);
  assert.equal(remaining[0].revision_id,orderedEntries[10].revisionId);
  console.log(JSON.stringify({pin:${JSON.stringify(pin)},target:'Node',mixedWrite:{error:result.error.code,draftPersists:true,versionDelta:after.version-before.version,liveUnchanged:true,apiOnlyUnchanged:true},publicPut:{invalidDateRejectedBeforeWrite:true,acceptedIsoFaultStatus:500,draftPersists:true,versionDelta:publicAfter.version-publicBefore.version,liveUnchanged:true},unpublishRetention:{cycles:55,beforeCleanup,afterCleanup:await count(),pruned,queueAcknowledged:true,livePointerPreserved:true},cleanupOrder:{queued:11,oldestAcknowledged:10,newestRemaining:1},completeRuntimeMethods:5,completeApiHandlers:2,completePublicPutCallback:1,completeCleanupConsumer:1,newParityCredit:0}));
} finally {await storage.close();}
`);
  await build({configFile:false,root:directory,logLevel:'warn',resolve:{alias:{
    '@emdash-cms/admin/slugify':join(directory,'packages/admin/src/slugify.ts'),'@emdash-cms/auth':join(directory,'fixture-auth.ts'),
    '#api/authorize.js':join(directory,'packages/core/src/api/authorize.ts'),'#api/error.js':join(directory,'packages/core/src/api/error.ts'),
    '#api/parse.js':join(directory,'packages/core/src/api/parse.ts'),'#api/schemas.js':join(directory,'packages/core/src/api/schemas/content.ts'),
    '#api/handlers/entry-lock.js':join(directory,'fixture-entry-lock.ts')
  }},build:{ssr:true,outDir:join(directory,'build'),rollupOptions:{input:join(directory,'probe.ts'),output:{entryFileNames:'probe.mjs'},external:[/^node:/,'kysely','ulidx','valibot','zod','miniflare']}}});
  await import(pathToFileURL(join(directory,'build/probe.mjs')).href);
  console.log(JSON.stringify({authority}));
} finally {await rm(directory,{recursive:true,force:true});}
