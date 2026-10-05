// Native D1 importer specialization of Source apply.ts889/1015. The whole Node
// Source engine remains unchanged. This uses the sole canonical content batch;
// it never executes a callback transaction or fabricates an uncommitted result.
// Source913cb1bb9b7f08c3ff0d258b4420e53835b6a58e, Copyright2026 Cloudflare Inc.
// MIT; notices/emdash-MIT.txt. Native D1 atomicity is intentionally stronger.
import {sql,type CompiledQuery} from 'kysely';
import {ulid} from 'ulidx';
import {CmsError,type CmsDatabase} from '../contract.ts';
import {DraftRepository,type DraftTranslationSource} from '../entries.ts';
import {SchemaRegistry} from '../registry.ts';
import {parse,identifier,entryId,localeInput,tableName} from '../validation.ts';
import {serializeValue} from '../field-value.ts';
import {isStoragelessField} from '../../schema/types.ts';
import {ContentRepository,writableContentData} from './upstream/database/repositories/content.ts';
import type {ContentItem,CreateContentInput} from './upstream/database/repositories/types.ts';
import {RevisionRepository,createRevisionId} from './upstream/database/repositories/revision.ts';
import {ContentDatetimeNormalizer} from './upstream/database/content-datetime.ts';
import {registerLifecycleDatabase} from './upstream/host.ts';
import {BylineRepository,type ContentBylineInput} from '../../bylines/repository.ts';
import {registerRelationDatabase} from '../../relations/storage.ts';
import {resolveReferenceSelectionTargets} from '../../relations/handlers.ts';
import {prepareContentReferenceWrites,type ContentReferencePlan} from '../../relations/content-plan.ts';
import {completeContentReferences} from '../../relations/content-input.ts';
import {invalidateCollectionCache,invalidateTaxonomyObjectCache} from '../../menus/object-cache.ts';

interface SeedContentSides {
 /** Exact Source resolution, before writing: missing references were warned/skipped. */
 readonly bylines?:ContentBylineInput[];
 readonly taxonomyTermIds:readonly string[];
 readonly references:Readonly<Record<string,string[]>>;
 readonly routable:boolean;
}
export interface SeedContentCreate extends SeedContentSides {
 readonly input:CreateContentInput;
 /** Trusted repository construction; omitted means Seed's create+publish. */
 readonly promote?:boolean;
}
export interface SeedContentUpdate extends SeedContentSides {
 readonly type:string;readonly id:string;readonly status:string;readonly data:Record<string,unknown>;
}
async function context(database:CmsDatabase,type:string) {
 // The importer reads the actual stored Source timezone option. This is trusted
 // constructor hosting, independent of request principals and mutation bodies.
 registerLifecycleDatabase(database,{timezone:async()=>{
  const row=await database.db.selectFrom('_cms_options').select('value').where('name','=','site:timezone').executeTakeFirst();
  if(!row)return undefined;try{const value=JSON.parse(row.value);return typeof value==='string'?value:undefined;}catch{return undefined;}
 }});
 registerRelationDatabase(database);
 const collection=await new SchemaRegistry(database).getCollectionWithFields(type);
 if(!collection)throw new CmsError('NOT_FOUND');
 return{collection,content:new ContentRepository(database.db as any),datetimes:new ContentDatetimeNormalizer(database.db as any)};
}
function guard(database:CmsDatabase,token:string,predicate:ReturnType<typeof sql>):CompiledQuery {
 return sql`INSERT INTO _cms_guards(token,pass) SELECT ${token},CASE WHEN ${predicate} THEN 1 ELSE 0 END`.compile(database.db);
}
type SeedPreparedSides={before:CompiledQuery[];after:CompiledQuery[];cleanup:CompiledQuery[];references:ContentReferencePlan};
async function sides(database:CmsDatabase,type:string,id:string,group:string,input:SeedContentSides,isUpdate:boolean):Promise<SeedPreparedSides> {
 const before:CompiledQuery[]=[],after:CompiledQuery[]=[],cleanup:CompiledQuery[]=[];
 const selections=[];
 for(const [field,ids]of Object.entries(input.references)){
  const resolved=await resolveReferenceSelectionTargets(database.db as any,type,field,ids,group);
  if(!resolved.success)throw new Error(`content.${type}: failed to write references for "${id}": ${resolved.error.message}`);
  selections.push({...resolved.data,entryGroup:group});
 }
 const references=await prepareContentReferenceWrites(database,selections);
 before.push(...references.before);after.push(...references.after);cleanup.push(...references.cleanup);
 if(input.bylines!==undefined||isUpdate)after.unshift(...await new BylineRepository(database).planContentBylineReplacement(type,id,input.bylines??[]));
 // Source updates clear every assignment even when the declarative seed omits
 // taxonomies. Terms store their real translation groups; absent terms are ignored.
 if(isUpdate)after.push(sql`DELETE FROM _cms_content_taxonomies WHERE collection=${type} AND entry_id=${group}`.compile(database.db));
 const groups=new Set<string>();
 for(const termId of input.taxonomyTermIds){
  const row=(await sql<{id:string;translation_group:string|null}>`SELECT id,translation_group FROM _cms_taxonomies WHERE id=${termId} OR translation_group=${termId} LIMIT 1`.execute(database.db)).rows[0];
  if(!row?.translation_group)continue;
  const token=ulid();before.push(guard(database,token,sql`EXISTS(SELECT 1 FROM _cms_taxonomies WHERE id=${row.id} AND translation_group=${row.translation_group})`));cleanup.push(sql`DELETE FROM _cms_guards WHERE token=${token}`.compile(database.db));groups.add(row.translation_group);
 }
 const terms=[...groups];for(let start=0;start<terms.length;start+=32)after.push(database.db.insertInto('_cms_content_taxonomies').values(terms.slice(start,start+32).map(taxonomy_id=>({collection:type,entry_id:group,taxonomy_id}))).onConflict(oc=>oc.doNothing()).compile());
 return{before,after,cleanup,references};
}
function checkPublication(status:string,routable:boolean,slug:string|null|undefined) {
 if(status==='published'&&routable&&!slug?.trim())throw new Error('Cannot publish routable content without a slug');
}
function completion(type:string,plan:Awaited<ReturnType<typeof sides>>) {
 invalidateCollectionCache(type);invalidateTaxonomyObjectCache();completeContentReferences(plan.references,type);
}
/** A real INSERT RETURNING receipt is returned only after the whole batch commits.
 * Source apply returns this pre-publication snapshot; actual persisted version is2. */
export async function applySeedContentCreate(database:CmsDatabase,input:SeedContentCreate):Promise<ContentItem> {
 const raw=input.input,type=parse(identifier,raw.type),locale=parse(localeInput,raw.locale||'en');
 const {collection,content,datetimes}=await context(database,type);
 const status=raw.status??'draft',promote=input.promote!==false;
 if(promote)checkPublication(status,input.routable,raw.slug);
 const data=writableContentData(await datetimes.normalizeInput(type,raw.data));
 const now=new Date().toISOString();
 let translation:DraftTranslationSource|undefined;
 if(raw.translationOf){const source=await content.findById(type,raw.translationOf);if(!source)throw new Error('Translation source not found');translation={id:source.id,translationGroup:source.translationGroup??source.id,version:source.version,updatedAt:source.updatedAt,inheritFields:raw.inheritFields??[]};}
 let prepared:Awaited<ReturnType<typeof sides>>|undefined;
 const row=await new DraftRepository(database).createSeed({type,locale,slug:raw.slug,data},async entry=>{
  prepared=await sides(database,type,entry.id,entry.translationGroup,input,false);
  const insertedToken=ulid();prepared.after.unshift(guard(database,insertedToken,sql`changes()=1 AND EXISTS(SELECT 1 FROM ${sql.ref(tableName(type))} WHERE id=${entry.id} AND locale=${locale} AND translation_group=${entry.translationGroup} AND version=1 AND deleted_at IS NULL)`));prepared.cleanup.push(sql`DELETE FROM _cms_guards WHERE token=${insertedToken}`.compile(database.db));
  if(status==='published'&&promote){
   const revisionId=createRevisionId();
   // Source first publication snapshots actual column defaults and serialized
   // field values. SQL reads the newly inserted row within this genuine batch.
   const fields=collection.fields.filter(field=>!isStoragelessField({...field,validation:field.validation??undefined}));
   const withNulls=fields.length?sql`json_object(${sql.join(fields.flatMap(field=>[sql`${field.slug}`,sql`CASE WHEN typeof(${sql.ref(field.slug)})='text' AND substr(${sql.ref(field.slug)},1,1) IN('[','{') AND json_valid(${sql.ref(field.slug)}) THEN json(${sql.ref(field.slug)}) ELSE ${sql.ref(field.slug)} END`]))})`:sql`'{}'`;
   const snapshot=sql`(SELECT json_group_object(key,CASE WHEN type IN('array','object') THEN json(value) ELSE value END) FROM json_each(${withNulls}) WHERE value IS NOT NULL)`;
   prepared.after.push(sql`INSERT INTO _cms_revisions(id,collection,entry_id,data,author_id) SELECT ${revisionId},${type},${entry.id},${snapshot},NULL FROM ${sql.ref(tableName(type))} WHERE id=${entry.id}`.compile(database.db));
   prepared.after.push(sql`UPDATE ${sql.ref(tableName(type))} SET live_revision_id=${revisionId},draft_revision_id=NULL,status='published',scheduled_at=NULL,published_at=COALESCE(published_at,${now}),updated_at=${now},version=version+1 WHERE id=${entry.id} AND deleted_at IS NULL AND version=1 AND EXISTS(SELECT 1 FROM _cms_revisions WHERE id=${revisionId} AND collection=${type} AND entry_id=${entry.id})`.compile(database.db));
   const publishedToken=ulid();prepared.after.push(guard(database,publishedToken,sql`changes()=1`));prepared.cleanup.push(sql`DELETE FROM _cms_guards WHERE token=${publishedToken}`.compile(database.db));
  }
  return prepared;
 },translation,{id:raw.id,authorId:raw.authorId||null,primaryBylineId:raw.primaryBylineId??null,status,createdAt:raw.createdAt?await datetimes.normalizeValue(type,raw.createdAt):now,updatedAt:now,publishedAt:raw.publishedAt?await datetimes.normalizeValue(type,raw.publishedAt):null});
 if(!prepared)throw new Error('Seed creation plan was not prepared');completion(type,prepared);
 return content.mapRow(type,row);
}
/** Exact Source direct repository create, with no automatic Seed promotion. */
export function createSourceContent(database:CmsDatabase,input:CreateContentInput):Promise<ContentItem> {
 return applySeedContentCreate(database,{input,promote:false,bylines:undefined,taxonomyTermIds:[],references:{},routable:false});
}
/** Source repository delete moves only deleted_at. The Native schema/row fence
 * remains, while ordinary authorized Native delete retains its existing policy. */
export async function deleteSourceContent(database:CmsDatabase,typeInput:string,idInput:string):Promise<boolean> {
 const type=parse(identifier,typeInput),id=parse(entryId,idInput);
 const {collection,content}=await context(database,type);const existing=await content.findById(type,id);if(!existing)return false;
 const token=ulid(),now=new Date().toISOString();
 const results=await database.atomicBatch([guard(database,token,sql`EXISTS(SELECT 1 FROM _cms_collections WHERE id=${collection.id} AND version=${collection.version})`),
  sql`UPDATE ${sql.ref(tableName(type))} SET deleted_at=${now} WHERE id=${id} AND deleted_at IS NULL AND version=${existing.version} AND updated_at=${existing.updatedAt} RETURNING id`.compile(database.db),
  sql`DELETE FROM _cms_guards WHERE token=${token}`.compile(database.db)]);
 const changed=results[1].rows.length>0;if(changed)invalidateCollectionCache(type);return changed;
}
/** The exact resolved declarative update, side writes, Source revision staging
 * and promotion share one schema/current-row fenced Native batch. */
export async function applySeedContentUpdate(database:CmsDatabase,input:SeedContentUpdate):Promise<ContentItem> {
 const type=parse(identifier,input.type),id=parse(entryId,input.id);
 const {collection,content,datetimes}=await context(database,type);
 const existing=await content.findById(type,id);if(!existing)throw new Error('Content not found');
 checkPublication(input.status,input.routable,existing.slug);
 const data=writableContentData(await datetimes.normalizeInput(type,input.data)),now=new Date().toISOString();
 const prepared=await sides(database,type,id,existing.translationGroup??id,input,true);
 const schemaToken=ulid(),updatedToken=ulid();
 const statements=[guard(database,schemaToken,sql`EXISTS(SELECT 1 FROM _cms_collections WHERE id=${collection.id} AND version=${collection.version})`),...prepared.before,
  sql`UPDATE ${sql.ref(tableName(type))} SET ${sql.join([sql`status=${input.status}`,...Object.entries(data).map(([key,value])=>sql`${sql.ref(key)}=${serializeValue(value)}`),sql`updated_at=${now}`,sql`version=version+1`])} WHERE id=${id} AND deleted_at IS NULL AND version=${existing.version} AND updated_at=${existing.updatedAt}`.compile(database.db),
  guard(database,updatedToken,sql`changes()=1`),...prepared.after];
 if(input.status==='published'){
  const revision=await new RevisionRepository(database.db as any).prepareCreate({collection:type,entryId:id,data:input.data});
  statements.push(revision.statement,
   sql`UPDATE ${sql.ref(tableName(type))} SET draft_revision_id=${revision.id},version=version+1 WHERE id=${id} AND deleted_at IS NULL AND version=${existing.version+1} AND EXISTS(SELECT 1 FROM _cms_revisions WHERE id=${revision.id} AND collection=${type} AND entry_id=${id})`.compile(database.db));
  const stagedToken=ulid();statements.push(guard(database,stagedToken,sql`changes()=1`));prepared.cleanup.push(sql`DELETE FROM _cms_guards WHERE token=${stagedToken}`.compile(database.db));
  statements.push(sql`UPDATE ${sql.ref(tableName(type))} SET live_revision_id=${revision.id},draft_revision_id=NULL,status='published',scheduled_at=NULL,published_at=COALESCE(published_at,${now}),updated_at=${now},version=version+1 WHERE id=${id} AND deleted_at IS NULL AND version=${existing.version+2} AND draft_revision_id=${revision.id}`.compile(database.db));
  const publishedToken=ulid();statements.push(guard(database,publishedToken,sql`changes()=1`));prepared.cleanup.push(sql`DELETE FROM _cms_guards WHERE token=${publishedToken}`.compile(database.db));
 }
 statements.push(...prepared.cleanup,sql`DELETE FROM _cms_guards WHERE token IN(${schemaToken},${updatedToken})`.compile(database.db));
 try{await database.atomicBatch(statements);}catch(cause){if(cause instanceof Error&&/CHECK constraint failed: pass = 1/.test(cause.message))throw new CmsError('CONFLICT');throw cause;}
 completion(type,prepared);const updated=await content.findById(type,id);if(!updated)throw new Error('Content not found');return updated;
}
