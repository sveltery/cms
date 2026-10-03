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
if(!upstream)throw new Error('Usage: node scripts/reproduce-content-composition-filter-keys-upstream.mjs /path/to/pinned-emdash-clone [--expect-native-fixed]');
const root=fileURLToPath(new URL('../',import.meta.url));
const expectNativeFixed=process.argv.includes('--expect-native-fixed');
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
  const extra=['packages/core/src/astro/routes/api/content/[collection]/index.ts','packages/core/src/schema/types.ts','packages/core/src/schema/zod-generator.ts','packages/core/src/utils/hash.ts','packages/core/src/api/handlers/validation.ts','packages/core/src/request-cache.ts',
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
  const helpers=['resolveBylineFilter','normalizeDateBound','handleContentList','hasApiError','decodeRevisionPrecondition','collectionHasSeo','getCollectionPublishConfig','requireRoutablePublishSlug','resolveId','slugStillTaken','createSlugChangeRedirect','handleContentUpdate','handleContentUnpublish','handleContentPublish','handleContentGet','handleContentGetIncludingTrashed','hydrateReferences','isRecord'].map(name=>declaration(api,name)).join('\n');
  const methods=['handleContentList','handleContentGet','handleContentGetIncludingTrashed','handleContentUpdate','hydrateDraftData','normalizeFieldValues','dropUnknownKeysAlreadyStored','handleContentUnpublish','handleContentPublish','getScheduledPolicyRejectionRevision','checkContentPolicy'].map(name=>declaration(runtime,name,true)).join('\n');
  const constants=['DRAFT_ONLY_UPDATE_KEYS','ARRAY_FIELD_TYPES','MAX_DRAFT_STAGE_ATTEMPTS'].map(name=>declaration(runtime,name)).join('\n');
  await put('packages/core/src/review-runtime.ts',`
import assert from 'node:assert/strict';
import {sql} from 'kysely';
import {validateIdentifier} from './database/validate.js';
import {ContentRepository} from './database/repositories/content.js';
import {RevisionRepository} from './database/repositories/revision.js';
import {ContentMutationConflictError,ContentCollectionNotFoundError,InvalidCursorError,EmDashValidationError,ScheduledNotDueError} from './database/repositories/types.js';
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
const hydrateBylinesMany=async()=>{};
const hydrateSeoMany=async(_db,_collection,_items,hasSeo)=>assert.equal(hasSeo,false);
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
import {schemaAdminStorage} from '${root}tests/helpers/schema-admin-storage.ts';
import {migrateCms} from '${root}src/lib/server/database/migrations.ts';
import {SchemaRegistry} from '${root}src/lib/server/database/registry.ts';
import {cmsService} from '${root}src/lib/server/database/service.ts';
import {SourceRuntime,ContentRepository} from './packages/core/src/review-runtime.ts';
import {GET} from './packages/core/src/astro/routes/api/content/[collection]/index.ts';
class Namespace extends OperationNodeTransformer {
 transformIdentifier(node){return {...node,name:node.name==='revisions'?'_cms_revisions':node.name.replace(/^_emdash_/,'_cms_')};}
 transformRaw(node){return {...super.transformRaw(node),sqlFragments:node.sqlFragments.map(part=>part.replaceAll('_emdash_','_cms_').replace(/\\brevisions\\b/g,'_cms_revisions'))};}
}
const expectNativeFixed=${expectNativeFixed};
const storage=await schemaAdminStorage('Node');
try{
 await migrateCms(storage.database);const registry=new SchemaRegistry(storage.database);
 await registry.createCollection({slug:'post',label:'Posts',supports:[]});
 await sql\`CREATE TABLE options(name TEXT PRIMARY KEY,value TEXT,revision TEXT)\`.execute(storage.database.db);
 for(const slug of ['title','constructor','prototype'])await registry.createField('post',{slug,label:slug,type:'string',indexed:slug!=='title'});
 const transformer=new Namespace();const db=storage.database.db.withPlugin({transformQuery:({node})=>transformer.transformNode(node),transformResult:async({result})=>result});
 globalThis.__lifecycleReviewRegistries=new WeakMap([[db,registry]]);globalThis.__lifecycleReviewAfter=[];
 const content=new ContentRepository(db);const runtime=new SourceRuntime(db,registry);
 const wanted=await content.create({type:'post',slug:'wanted',locale:'en',authorId:'review-admin',data:JSON.parse('{"title":"Wanted","constructor":"x","prototype":"x"}')});
 await content.create({type:'post',slug:'other',locale:'en',authorId:'review-admin',data:JSON.parse('{"title":"Other","constructor":"y","prototype":"y"}')});
 const native=cmsService(storage.database,{id:'review-admin',permissions:['content:read','content:read_drafts']});
 const results=[];
 for(const key of ['constructor','prototype']){
  const filters=JSON.parse('{"'+key+'":"x"}');
  const url=new URL('https://source.example/_emdash/api/content/post');url.searchParams.set('fieldFilters',JSON.stringify(filters));
  const response=await GET({params:{collection:'post'},url,locals:{emdash:runtime,user:{id:'review-admin',role:50}}});const body=await response.json();
  assert.equal(response.status,200,JSON.stringify(body));assert.equal(body.success,true);assert.equal(body.data.total,1);assert.deepEqual(body.data.items.map(item=>item.id),[wanted.id]);
  const actual=await native.listContent({type:'post',fieldFilters:filters});assert.equal(actual.total,expectNativeFixed?1:2);if(expectNativeFixed)assert.deepEqual(actual.items.map(item=>item.id),[wanted.id]);
  results.push({key,sourceStatus:response.status,sourceTotal:body.data.total,nativeTotal:actual.total,nativeLostFilter:actual.total!==1});
 }
 console.log(JSON.stringify({pin:'913cb1bb9b7f08c3ff0d258b4420e53835b6a58e',target:'Node',results,completePublicListCallback:1,completeParseQueryAndContentListSchema:true,completeRuntimeList:1,completeApiList:1,completeRepositoryFindMany:true,sourceCredit:0,hosts:'metadata namespace-only; actual indexed string fields; no SEO/bylines; no search/byline/date/order filters or subscribers/auth middleware credit'}));
}finally{await storage.close();}
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
