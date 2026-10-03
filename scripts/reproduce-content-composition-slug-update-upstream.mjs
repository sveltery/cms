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
if(!upstream)throw new Error('Usage: node scripts/reproduce-content-composition-slug-update-upstream.mjs /path/to/pinned-emdash-clone');
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
    'packages/auth/src/rbac.ts','packages/auth/src/types.ts','packages/core/src/astro/routes/api/content/[collection]/[id].ts','packages/core/src/astro/routes/api/content/[collection]/[id]/unpublish.ts',
    'packages/core/src/astro/routes/api/content/[collection]/[id]/publish.ts','packages/core/src/database/repositories/options.ts','packages/core/src/plugins/conditional-storage.ts','packages/core/src/plugins/content-policy.ts','packages/core/src/references/staged.ts'];
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
  const helpers=['hasApiError','decodeRevisionPrecondition','collectionHasSeo','getCollectionPublishConfig','requireRoutablePublishSlug','resolveId','slugStillTaken','createSlugChangeRedirect','handleContentUpdate','handleContentUnpublish','handleContentPublish','handleContentGet','hydrateReferences','isRecord'].map(name=>declaration(api,name)).join('\n');
  const methods=['handleContentGet','handleContentUpdate','hydrateDraftData','normalizeFieldValues','dropUnknownKeysAlreadyStored','handleContentUnpublish','handleContentPublish','getScheduledPolicyRejectionRevision','checkContentPolicy'].map(name=>declaration(runtime,name,true)).join('\n');
  const constants=['DRAFT_ONLY_UPDATE_KEYS','ARRAY_FIELD_TYPES','MAX_DRAFT_STAGE_ATTEMPTS'].map(name=>declaration(runtime,name)).join('\n');
  await put('packages/core/src/review-runtime.ts',`
import assert from 'node:assert/strict';
import {sql} from 'kysely';
import {validateIdentifier} from './database/validate.js';
import {ContentRepository} from './database/repositories/content.js';
import {RevisionRepository} from './database/repositories/revision.js';
import {ContentMutationConflictError,EmDashValidationError,ScheduledNotDueError} from './database/repositories/types.js';
import {OptionsRepository} from './database/repositories/options.js';
import {scheduledPolicyRejectionKey} from './plugins/content-policy.js';
import {readStagedReferences,readStagedReferenceBaselines} from './references/staged.js';
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
// No bound reference fields exist in this scalar fixture. Their absent host
// provider is explicit; this guard cannot fabricate successful selections.
const validateStagedReferences=async(db,type,staged)=>{
  assert.equal(Object.keys(staged).length,0);
  assert.equal((await db.selectFrom('_emdash_fields').innerJoin('_emdash_collections','_emdash_collections.id','_emdash_fields.collection_id')
    .select('_emdash_fields.slug').where('_emdash_collections.slug','=',type).where('_emdash_fields.type','=','reference').execute()).length,0);
  return {success:true,data:true};
};
${constants}
${helpers}
const REVISION_KEEP_COUNT=50;
const REVISION_PRUNE_BATCH_SIZE=10;
export ${declaration(cleanup,'pruneQueuedRevisions')}
export {ContentRepository,RevisionRepository,handleContentUpdate as apiUpdate,handleContentGet as apiGet};
export class SourceRuntime {
  constructor(db,schemaRegistry){this.db=db;this.schemaRegistry=schemaRegistry;this.hooks={hasHooks:()=>false};}
  async refreshContentUsageAfterSuccessfulWrite(){}
  runAfterSaveHooks(){}
  runAfterUnpublishHooks(){}
  ${methods}
}
`);
  await symlink(join(root,'node_modules'),join(directory,'node_modules'));
  await put('probe.ts',`
import assert from 'node:assert/strict';
import {sql,OperationNodeTransformer} from 'kysely';
import {schemaAdminStorage} from '${root}/tests/helpers/schema-admin-storage.ts';
import {migrateCms} from '${root}/src/lib/server/database/migrations.ts';
import {SchemaRegistry} from '${root}/src/lib/server/database/registry.ts';
import {SourceRuntime,ContentRepository,RevisionRepository} from './packages/core/src/review-runtime.ts';
import {PUT} from './packages/core/src/astro/routes/api/content/[collection]/[id].ts';

class Namespace extends OperationNodeTransformer {
 transformIdentifier(node){return {...node,name:node.name==='revisions'?'_cms_revisions':node.name.replace(/^_emdash_/,'_cms_')};}
 transformRaw(node){return {...super.transformRaw(node),sqlFragments:node.sqlFragments.map(part=>part.replaceAll('_emdash_','_cms_').replace(/\\brevisions\\b/g,'_cms_revisions'))};}
}

const storage=await schemaAdminStorage('Node');
try {
 await migrateCms(storage.database);
 const registry=new SchemaRegistry(storage.database);
 await registry.createCollection({slug:'post',label:'Posts'});
 await registry.createField('post',{slug:'title',label:'Title',type:'string'});
 await sql\`CREATE TABLE options(name TEXT PRIMARY KEY,value TEXT,revision TEXT)\`.execute(storage.database.db);
 const transformer=new Namespace();
 const db=storage.database.db.withPlugin({transformQuery:({node})=>transformer.transformNode(node),transformResult:async({result})=>result});
 globalThis.__lifecycleReviewRegistries=new WeakMap([[db,registry]]);
 globalThis.__lifecycleReviewAfter=[];
 const content=new ContentRepository(db),revisions=new RevisionRepository(db),runtime=new SourceRuntime(db,registry);
 const observations=[];

 for (const explicitData of [false,true]) {
  const prefix=explicitData?'explicit-empty-data':'absent-data';
  const oldSlug=prefix+'-live',newSlug=prefix+'-new';
  const created=await content.create({type:'post',slug:oldSlug,locale:'en',authorId:'review-admin',data:{title:prefix+' title'}});
  await content.publish('post',created.id);
  // This real row keeps the old URL occupied. The complete original redirect
  // helper refuses before it needs a redirects provider. No redirect or i18n
  // product behavior is earned by this deliberately bounded storage fixture.
  await content.create({type:'post',slug:oldSlug,locale:'fr',data:{title:'Sibling holds old URL'}});
  const before=await content.findById('post',created.id);
  assert.equal(before.draftRevisionId,null);
  assert.ok(before.liveRevisionId);
  const history=()=>db.selectFrom('revisions').selectAll().where('entry_id','=',created.id).orderBy('id').execute();
  const revisionsBefore=await history();
  const body=explicitData?{data:{},slug:newSlug}:{slug:newSlug};
  const response=await PUT({params:{collection:'post',id:created.id},request:new Request('https://source.example/_emdash/api/content/post/'+created.id,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(body)}),locals:{emdash:runtime,user:{id:'review-admin',role:50}},cache:{enabled:false}});
  assert.equal(response.status,200);
  const result=await response.json();assert.equal(result.success,true);
  const after=await content.findById('post',created.id),revisionsAfter=await history();
  assert.equal(after.version,before.version+1);
  assert.equal(after.liveRevisionId,before.liveRevisionId);
  assert.equal(after.status,'published');
  assert.equal(after.data.title,before.data.title);
  assert.equal(result.data.item.data.title,before.data.title);
  let stagedSlug=null;
  if (explicitData) {
   assert.equal(after.slug,oldSlug);
   assert.ok(after.draftRevisionId);
   assert.equal(revisionsAfter.length,revisionsBefore.length+1);
   assert.deepEqual(revisionsAfter.filter(row=>row.id!==after.draftRevisionId),revisionsBefore);
   const draft=await revisions.findById(after.draftRevisionId);
   assert.equal(draft.data._slug,newSlug);
   assert.equal(draft.data.title,before.data.title);
   assert.equal(result.data.item.slug,oldSlug);
   assert.equal(result.data.item.liveData.title,before.data.title);
   stagedSlug=draft.data._slug;
  } else {
   assert.equal(after.slug,newSlug);
   assert.equal(after.draftRevisionId,null);
   assert.deepEqual(revisionsAfter,revisionsBefore);
   assert.equal(result.data.item.slug,newSlug);
   assert.equal(result.data.item.liveData,undefined);
  }
  for (const task of globalThis.__lifecycleReviewAfter.splice(0))await task();
  assert.deepEqual(await history(),revisionsAfter);
  observations.push({body,responseStatus:response.status,before:{slug:before.slug,version:before.version,liveRevisionId:before.liveRevisionId,draftRevisionId:before.draftRevisionId,revisionRows:revisionsBefore.length},after:{slug:after.slug,version:after.version,liveRevisionId:after.liveRevisionId,draftRevisionId:after.draftRevisionId,revisionRows:revisionsAfter.length,stagedSlug},versionDelta:after.version-before.version,historyDelta:revisionsAfter.length-revisionsBefore.length,liveDataUnchanged:true,priorHistoryUnchanged:true});
 }
 const blankObservations=[];
 for (const clearSlug of [null,'']) {
  for (const explicitData of [false,true]) {
   for (let repetition=1;repetition<=2;repetition++) {
    const prefix=(clearSlug===null?'null':'empty-string')+'-'+(explicitData?'explicit-data':'absent-data')+'-'+repetition;
    const oldSlug=prefix+'-live';
    const created=await content.create({type:'post',slug:oldSlug,locale:'en',authorId:'review-admin',data:{title:prefix+' title'}});
    await content.publish('post',created.id);
    await content.create({type:'post',slug:oldSlug,locale:'fr',data:{title:'Sibling holds old URL'}});
    const before=await content.findById('post',created.id);
    const history=()=>db.selectFrom('revisions').selectAll().where('entry_id','=',created.id).orderBy('id').execute();
    const revisionsBefore=await history();
    const body=explicitData?{data:{},slug:clearSlug}:{slug:clearSlug};
    const response=await PUT({params:{collection:'post',id:created.id},request:new Request('https://source.example/_emdash/api/content/post/'+created.id,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(body)}),locals:{emdash:runtime,user:{id:'review-admin',role:50}},cache:{enabled:false}});
    const result=await response.json();
    const after=await content.findById('post',created.id),revisionsAfter=await history();
    const draft=after.draftRevisionId?await revisions.findById(after.draftRevisionId):null;
    assert.equal(before.draftRevisionId,null);assert.ok(before.liveRevisionId);
    assert.equal(after.liveRevisionId,before.liveRevisionId);
    assert.equal(after.status,'published');assert.equal(after.data.title,before.data.title);
    const expectedStatus=explicitData?200:400;
    assert.equal(response.status,expectedStatus);
    if (expectedStatus!==200) {
     assert.equal(result.success,false);
     assert.equal(result.error.code,expectedStatus===400?'VALIDATION_ERROR':'SLUG_CONFLICT');
     assert.equal(result.error.message,expectedStatus===400?'Cannot publish routable content without a slug':"Slug '' already exists in collection 'nonroute'");
     assert.deepEqual(after,before);assert.deepEqual(revisionsAfter,revisionsBefore);
    } else {
     assert.equal(result.success,true);assert.equal(after.version,before.version+1);
     assert.equal(result.data.item.data.title,before.data.title);
     if (explicitData) {
      assert.equal(after.slug,oldSlug);assert.ok(after.draftRevisionId);
      assert.equal(revisionsAfter.length,revisionsBefore.length+1);
      assert.deepEqual(revisionsAfter.filter(row=>row.id!==after.draftRevisionId),revisionsBefore);
      assert.equal(Object.hasOwn(draft.data,'_slug'),true);
      assert.equal(draft.data._slug,clearSlug);assert.equal(draft.data.title,before.data.title);
      assert.equal(result.data.item.slug,oldSlug);assert.equal(result.data.item.liveData.title,before.data.title);
     } else {
      assert.equal(after.slug,clearSlug);assert.equal(after.draftRevisionId,null);
      assert.deepEqual(revisionsAfter,revisionsBefore);assert.equal(result.data.item.slug,clearSlug);
      assert.equal(result.data.item.liveData,undefined);
     }
    }

    for (const task of globalThis.__lifecycleReviewAfter.splice(0))await task();
    assert.deepEqual(await history(),revisionsAfter);
    blankObservations.push({body,repetition,responseStatus:response.status,result,before:{slug:before.slug,version:before.version,liveRevisionId:before.liveRevisionId,draftRevisionId:before.draftRevisionId,revisionRows:revisionsBefore.length},after:{slug:after.slug,version:after.version,liveRevisionId:after.liveRevisionId,draftRevisionId:after.draftRevisionId,revisionRows:revisionsAfter.length,stagedSlugPresent:draft?Object.hasOwn(draft.data,'_slug'):false,stagedSlug:draft?.data._slug},versionDelta:after.version-before.version,historyDelta:revisionsAfter.length-revisionsBefore.length,priorHistoryUnchanged:JSON.stringify(revisionsAfter.filter(row=>row.id!==after.draftRevisionId))===JSON.stringify(revisionsBefore)});
   }
  }
 }
 console.log(JSON.stringify({blankObservations,assertionBacked:true,newSourceTestCredit:0}));
 await registry.createCollection({slug:'nonroute',label:'Nonroutable',routable:false,urlPattern:null});
 await registry.createField('nonroute',{slug:'title',label:'Title',type:'string'});
 const nonrouteMetadata=await db.selectFrom('_emdash_collections').select(['routable','url_pattern']).where('slug','=','nonroute').executeTakeFirst();
 assert.equal(nonrouteMetadata.routable,0);assert.equal(nonrouteMetadata.url_pattern,null);
 const nonroutableObservations=[];
 for (const clearSlug of [null,'']) {
  for (const explicitData of [false,true]) {
   for (let repetition=1;repetition<=2;repetition++) {
    const prefix=(clearSlug===null?'null':'empty-string')+'-'+(explicitData?'explicit-data':'absent-data')+'-'+repetition;
    const oldSlug=prefix+'-live';
    const created=await content.create({type:'nonroute',slug:oldSlug,locale:'en',authorId:'review-admin',data:{title:prefix+' title'}});
    await content.publish('nonroute',created.id);
    await content.create({type:'nonroute',slug:oldSlug,locale:'fr',data:{title:'Sibling holds old URL'}});
    const before=await content.findById('nonroute',created.id);
    const history=()=>db.selectFrom('revisions').selectAll().where('entry_id','=',created.id).orderBy('id').execute();
    const revisionsBefore=await history();
    const body=explicitData?{data:{},slug:clearSlug}:{slug:clearSlug};
    const response=await PUT({params:{collection:'nonroute',id:created.id},request:new Request('https://source.example/_emdash/api/content/nonroute/'+created.id,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(body)}),locals:{emdash:runtime,user:{id:'review-admin',role:50}},cache:{enabled:false}});
    const result=await response.json();
    const after=await content.findById('nonroute',created.id),revisionsAfter=await history();
    const draft=after.draftRevisionId?await revisions.findById(after.draftRevisionId):null;
    assert.equal(before.draftRevisionId,null);assert.ok(before.liveRevisionId);
    assert.equal(after.liveRevisionId,before.liveRevisionId);
    assert.equal(after.status,'published');assert.equal(after.data.title,before.data.title);
    const expectedStatus=explicitData?200:(clearSlug===''&&repetition===2?409:200);
    assert.equal(response.status,expectedStatus);
    if (expectedStatus!==200) {
     assert.equal(result.success,false);
     assert.equal(result.error.code,expectedStatus===400?'VALIDATION_ERROR':'SLUG_CONFLICT');
     assert.equal(result.error.message,expectedStatus===400?'Cannot publish routable content without a slug':"Slug '' already exists in collection 'nonroute'");
     assert.deepEqual(after,before);assert.deepEqual(revisionsAfter,revisionsBefore);
    } else {
     assert.equal(result.success,true);assert.equal(after.version,before.version+1);
     assert.equal(result.data.item.data.title,before.data.title);
     if (explicitData) {
      assert.equal(after.slug,oldSlug);assert.ok(after.draftRevisionId);
      assert.equal(revisionsAfter.length,revisionsBefore.length+1);
      assert.deepEqual(revisionsAfter.filter(row=>row.id!==after.draftRevisionId),revisionsBefore);
      assert.equal(Object.hasOwn(draft.data,'_slug'),true);
      assert.equal(draft.data._slug,clearSlug);assert.equal(draft.data.title,before.data.title);
      assert.equal(result.data.item.slug,oldSlug);assert.equal(result.data.item.liveData.title,before.data.title);
     } else {
      assert.equal(after.slug,clearSlug);assert.equal(after.draftRevisionId,null);
      assert.deepEqual(revisionsAfter,revisionsBefore);assert.equal(result.data.item.slug,clearSlug);
      assert.equal(result.data.item.liveData,undefined);
     }
    }

    for (const task of globalThis.__lifecycleReviewAfter.splice(0))await task();
    assert.deepEqual(await history(),revisionsAfter);
    nonroutableObservations.push({body,repetition,responseStatus:response.status,result,before:{slug:before.slug,version:before.version,liveRevisionId:before.liveRevisionId,draftRevisionId:before.draftRevisionId,revisionRows:revisionsBefore.length},after:{slug:after.slug,version:after.version,liveRevisionId:after.liveRevisionId,draftRevisionId:after.draftRevisionId,revisionRows:revisionsAfter.length,stagedSlugPresent:draft?Object.hasOwn(draft.data,'_slug'):false,stagedSlug:draft?.data._slug},versionDelta:after.version-before.version,historyDelta:revisionsAfter.length-revisionsBefore.length,priorHistoryUnchanged:JSON.stringify(revisionsAfter.filter(row=>row.id!==after.draftRevisionId))===JSON.stringify(revisionsBefore)});
   }
  }
 }
 console.log(JSON.stringify({nonroutableObservations,assertionBacked:true,newSourceTestCredit:0}));

 const persistedNulls=await db.selectFrom('ec_nonroute').select(['id','slug','locale','draft_revision_id']).where('locale','=','en').where('slug','is',null).execute();
 const persistedEmpty=await db.selectFrom('ec_nonroute').select(['id','slug','locale','draft_revision_id']).where('locale','=','en').where('slug','=','').execute();
 assert.equal(persistedNulls.length,2);assert.equal(persistedEmpty.length,1);
 for (const row of persistedNulls) {assert.equal(row.slug,null);assert.equal(row.draft_revision_id,null);}
 assert.equal(persistedEmpty[0].slug,'');assert.equal(persistedEmpty[0].draft_revision_id,null);
 console.log(JSON.stringify({assertionBacked:true,physicalUniqueness:{sameLocaleNullRows:persistedNulls.length,sameLocaleEmptyStringRows:persistedEmpty.length,secondEmptyStringWrite:{status:409,code:'SLUG_CONFLICT'},secondNullWrite:{status:200}},nativeTransportSubstitution:'Native HTML blank may intentionally mean Source JSON null; it does not equal Source JSON empty string. Source routable published metadata guard and public native parity remain outside native ordinary-admin proof.',newSourceTestCredit:0}));

 console.log(JSON.stringify({pin:'913cb1bb9b7f08c3ff0d258b4420e53835b6a58e',target:'Node SQLite',observations,completePublicPut:1,completeRuntimeGet:1,completeRuntimeUpdate:1,completeRuntimeHydration:1,completeApiGet:1,completeApiUpdate:1,completeRepositories:['content','revision'],completeDecoder:true,completeUpdateSchema:true,newSourceTestCredit:0,scope:'scalar title, real persisted source-created/source-published separate entries, unchanged Source optional revision behavior; namespace-only table remapping, explicit native schema registry and scalar guards; original redirect helper early-refuses on real sibling old slug; no successful redirect, localization, authentication middleware, entry locks, plugins/hooks, SEO/bylines, references, cache, settings, scheduling, Source D1 or public native API parity credit'}));
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
