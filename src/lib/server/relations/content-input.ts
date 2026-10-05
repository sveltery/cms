// Source resolve-before-write and required-reference contract at immutable
//913cb1bb9b7f08c3ff0d258b4420e53835b6a58e content.ts1213/1245/1563.
// Copyright2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
import {sql} from 'kysely';
import {CmsError,type CmsDatabase} from '../database/contract.ts';
import {invalidateCollectionCache} from '../menus/object-cache.ts';
import {resolveReferenceSelectionTargets,resolveReferenceSelection,type ResolvedReferenceTargets,type ReferenceSelectionWrite} from './handlers.ts';
import {validateRequiredReferencesPresent} from './validate-references.ts';
import {prepareContentReferenceCreates,prepareContentReferenceWrites,type ContentReferencePlan} from './content-plan.ts';
import {registerRelationDatabase} from './storage.ts';

type References=Record<string,string[]>|undefined;
function requireSuccess<T>(result:{success:true;data:T}|{success:false;error:{code:string;message:string}}):T{
 if(!result.success)throw new CmsError(result.error.code as ConstructorParameters<typeof CmsError>[0],result.error.message);
 return result.data;
}
export async function prepareContentReferencesCreate(database:CmsDatabase,collection:string,references:References,translationOf?:string){
 registerRelationDatabase(database);
 const db=database.db as any;
 requireSuccess(await validateRequiredReferencesPresent(db,collection,references,translationOf));
 const entryGroup=translationOf?(await new (await import('../database/lifecycle/upstream/database/repositories/content.ts')).ContentRepository(db).findById(collection,translationOf))?.translationGroup??null:null;
 const selections:ResolvedReferenceTargets[]=[];
 for(const [field,ids] of Object.entries(references??{}))selections.push(requireSuccess(await resolveReferenceSelectionTargets(db,collection,field,ids,entryGroup)));
 return prepareContentReferenceCreates(database,selections);
}
export async function prepareContentReferencesUpdate(database:CmsDatabase,collection:string,id:string,references:References):Promise<ContentReferencePlan>{
 registerRelationDatabase(database);
 const selections:ReferenceSelectionWrite[]=[];
 for(const [field,ids] of Object.entries(references??{}))selections.push(requireSuccess(await resolveReferenceSelection(database.db as any,collection,id,field,ids)));
 return prepareContentReferenceWrites(database,selections);
}
/** Called only after the sole content writer confirms its whole batch. */
export function completeContentReferences(plan:ContentReferencePlan,selectingCollection?:string):void{
 const collections=new Set(plan.touchedCollections);
 if(selectingCollection)collections.add(selectingCollection);
 for(const collection of collections)invalidateCollectionCache(collection);
}

/** A committed reference-only draft changes the selecting collection's read
 * snapshot while the live links and opposite collection remain unchanged. */
export function completeContentReferenceDraft(collection:string):void{
 invalidateCollectionCache(collection);
}

/** Source runtime staging reads actual targets and the live selection once;
 * baselines are owned persisted data, never caller-supplied JSON. */
export async function prepareContentReferenceDraft(database:CmsDatabase,collection:string,id:string,references:References){
 registerRelationDatabase(database);
 const staged:Record<string,string[]>={};let entryGroup:string|undefined;
 for(const [field,ids] of Object.entries(references??{})){
  const resolved=requireSuccess(await resolveReferenceSelection(database.db as any,collection,id,field,ids));
  staged[field]=resolved.groups;entryGroup=resolved.entryGroup;
 }
 const {liveReferenceSelection}=await import('./staged-content.ts');
 const baselines:Record<string,string[]>={};
 if(entryGroup){const live=await liveReferenceSelection(database.db as any,collection,entryGroup);for(const field of Object.keys(staged))baselines[field]=live[field]??[];}
 return{staged,baselines};
}

/** Source publication validation/diff, entirely read-only. The existing
 * publication executor commits edges and the actual promoted revision together. */
export async function prepareContentReferencePublication(database:CmsDatabase,collection:string,entry:{id:string;translationGroup:string|null;draftRevisionId:string|null},revisionData:Record<string,unknown>|undefined):Promise<ContentReferencePlan>{
 registerRelationDatabase(database);
 if(!entry.translationGroup)return{before:[],after:[],cleanup:[],touchedCollections:[]};
 const {readStagedReferences,readStagedReferenceBaselines,liveReferenceSelection,validateStagedReferences,referenceSelectionDiff}=await import('./staged-content.ts');
 const {referenceFieldConstraints}=await import('./validate-references.ts');
 const db=database.db as any;
 const staged=readStagedReferences(revisionData)??{};
 const baselines=readStagedReferenceBaselines(revisionData);
 requireSuccess(await validateStagedReferences(db,collection,staged,entry.translationGroup,baselines));
 const live=await liveReferenceSelection(db,collection,entry.translationGroup);
 const constraints=await referenceFieldConstraints(db,collection);
 const selections:ReferenceSelectionWrite[]=[];
 const published={...live};
 for(const [slug,groups] of Object.entries(staged)){
  const field=constraints.get(slug);if(!field)continue;
  const selection=baselines?.[slug]?referenceSelectionDiff(baselines[slug],groups,live[slug]??[]):groups;
  published[slug]=selection;
  selections.push({relation:field.relation,side:field.relationSide,entryGroup:entry.translationGroup,groups:selection});
 }
 const plan=await prepareContentReferenceWrites(database,selections);
 if(Object.keys(published).length===0)return plan;
 // The actual content UPDATE supplies the authoritative live revision ID.
 // json_set shallow-merges only the owned Source reserved key and retains all
 // scalar data, staged slug and historical baseline bytes in that real row.
 const record=sql`UPDATE _cms_revisions SET data=json_set(data,'$._references',json(${JSON.stringify(published)}))
  WHERE id=(SELECT live_revision_id FROM ${sql.ref(`ec_${collection}`)} WHERE id=${entry.id})
  AND collection=${collection} AND entry_id=${entry.id}`.compile(database.db);
 return{...plan,after:[...plan.after,record]};
}

/** Source direct restoration replaces the named selections wholesale. Unlike
 * publication it leaves the previous live revision's historical data intact. */
export async function prepareContentReferenceRestore(database:CmsDatabase,collection:string,entryGroup:string,revisionData:Record<string,unknown>):Promise<ContentReferencePlan>{
 registerRelationDatabase(database);
 const {readStagedReferences,validateStagedReferences}=await import('./staged-content.ts');
 const {referenceFieldConstraints}=await import('./validate-references.ts');
 const staged=readStagedReferences(revisionData)??{};const db=database.db as any;
 requireSuccess(await validateStagedReferences(db,collection,staged,entryGroup));
 const constraints=await referenceFieldConstraints(db,collection);const selections:ReferenceSelectionWrite[]=[];
 for(const [slug,groups] of Object.entries(staged)){const field=constraints.get(slug);if(field)selections.push({relation:field.relation,side:field.relationSide,entryGroup,groups});}
 return prepareContentReferenceWrites(database,selections);
}
