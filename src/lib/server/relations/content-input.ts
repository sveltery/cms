// Source resolve-before-write and required-reference contract at immutable
//913cb1bb9b7f08c3ff0d258b4420e53835b6a58e content.ts1213/1245/1563.
// Copyright2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
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
export async function prepareContentReferencesCreate(database:CmsDatabase,collection:string,references:References){
 registerRelationDatabase(database);
 const db=database.db as any;
 requireSuccess(await validateRequiredReferencesPresent(db,collection,references,undefined));
 const selections:ResolvedReferenceTargets[]=[];
 for(const [field,ids] of Object.entries(references??{}))selections.push(requireSuccess(await resolveReferenceSelectionTargets(db,collection,field,ids,null)));
 return prepareContentReferenceCreates(database,selections);
}
export async function prepareContentReferencesUpdate(database:CmsDatabase,collection:string,id:string,references:References):Promise<ContentReferencePlan>{
 registerRelationDatabase(database);
 const selections:ReferenceSelectionWrite[]=[];
 for(const [field,ids] of Object.entries(references??{}))selections.push(requireSuccess(await resolveReferenceSelection(database.db as any,collection,id,field,ids)));
 return prepareContentReferenceWrites(database,selections);
}
/** Called only after the sole content writer confirms its whole batch. */
export function completeContentReferences(plan:ContentReferencePlan):void{
 for(const collection of plan.touchedCollections)invalidateCollectionCache(collection);
}
