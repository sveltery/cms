// Read-only Native content composition of the whole pinned Source ordered
// relation selection algorithms. Copyright 2026 Cloudflare Inc. MIT;
// immutable913cb1bb9b7f08c3ff0d258b4420e53835b6a58e, notices/emdash-MIT.txt.
import {sql,type CompiledQuery} from 'kysely';
import {ulid} from 'ulidx';
import type {CmsDatabase} from '../database/contract.ts';
import {RelationRepository,type Relation} from './repository.ts';
import type {ReferenceSelectionWrite,ResolvedReferenceTargets} from './handlers.ts';
import {addPlan,removePlan,positionPlan,relationGuard} from './atomic.ts';

export interface ContentReferencePlan {
 readonly before:readonly CompiledQuery[];
 readonly after:readonly CompiledQuery[];
 readonly cleanup:readonly CompiledQuery[];
 readonly touchedCollections:readonly string[];
}
type Edge={id:string;relation_id:string;parent_group:string;child_group:string;sort_order:number;created_at:string};
interface PreparedSelection {relation:Relation;selection:ResolvedReferenceTargets;existing:Edge[];positions:Map<string,number>}
async function prepare(database:CmsDatabase,selection:ResolvedReferenceTargets,entryGroup:string|null):Promise<PreparedSelection>{
 const repo=new RelationRepository(database);
 const relation=await repo.findById(selection.relation)??await repo.findBySlug(selection.relation);
 if(!relation)throw new Error('Reference relation no longer exists');
 const side=selection.side==='parent'?'parent_group':'child_group';
 const existing=entryGroup===null?[]:await database.db.selectFrom('_cms_content_references').selectAll()
  .where('relation_id','=',relation.id).where(side,'=',entryGroup).execute() as Edge[];
 const positions=new Map<string,number>();
 if(selection.side==='child'){
  const current=new Set(existing.map(edge=>edge.parent_group));
  const added=[...new Set(selection.groups)].filter(group=>!current.has(group));
  for(let start=0;start<added.length;start+=16){
   const rows=await database.db.selectFrom('_cms_content_references')
    .select(eb=>['parent_group',eb.fn.max('sort_order').as('max')])
    .where('relation_id','=',relation.id).where('parent_group','in',added.slice(start,start+16)).groupBy('parent_group').execute();
   for(const row of rows)positions.set(row.parent_group,row.max===null?0:Number(row.max)+1);
  }
 }
 return{relation,selection,existing,positions};
}
function compile(database:CmsDatabase,prepared:PreparedSelection,entryGroup:string):ContentReferencePlan{
 const {relation,selection,existing,positions}=prepared;
 const db=database.db as any;
 const groups=[...new Set(selection.groups)];
 const selected=new Set(groups);
 const parent=selection.side==='parent';
 const other=parent?'child_group':'parent_group';
 const present=new Set(existing.map(edge=>edge[other]));
 const order=new Map(groups.map((group,index)=>[group,index]));
 const now=new Date().toISOString();
 const additions=groups.flatMap(group=>present.has(group)?[]:[{id:ulid(),relation_id:relation.id,
  parent_group:parent?entryGroup:group,child_group:parent?group:entryGroup,
  sort_order:parent?order.get(group)!:positions.get(group)??0,created_at:now}]);
 const removals=existing.filter(edge=>!selected.has(edge[other])).map(edge=>edge.id);
 const moves=parent?existing.flatMap(edge=>{
  const target=order.get(edge.child_group);return target===undefined||target===edge.sort_order?[]:[{id:edge.id,sortOrder:target}];
 }):[];
 const token=`content-reference:${ulid()}`;
 return{before:[relationGuard(db,relation,token)],
  after:[...addPlan(db,additions,parent?'child':'parent',parent?relation.maxParentsPerChild:relation.maxChildrenPerParent,token),
   ...removePlan(db,removals),...positionPlan(db,moves)],
  cleanup:[sql`DELETE FROM _cms_guards WHERE token=${token}`.compile(db)],
  touchedCollections:[...new Set([relation.parentCollection,relation.childCollection])]};
}
function combine(plans:readonly ContentReferencePlan[]):ContentReferencePlan{
 return{before:plans.flatMap(plan=>plan.before),after:plans.flatMap(plan=>plan.after),cleanup:plans.flatMap(plan=>plan.cleanup),
  touchedCollections:[...new Set(plans.flatMap(plan=>plan.touchedCollections))]};
}
/** Executes only genuine reads. The sole content writer commits every returned statement. */
export async function prepareContentReferenceWrites(database:CmsDatabase,selections:readonly ReferenceSelectionWrite[]):Promise<ContentReferencePlan>{
 const plans:ContentReferencePlan[]=[];
 for(const selection of selections)plans.push(compile(database,await prepare(database,selection,selection.entryGroup),selection.entryGroup));
 return combine(plans);
}
/** Resolve definitions and child-side append positions before the new row is written;
 * the existing DraftRepository supplies its actual generated group synchronously. */
export async function prepareContentReferenceCreates(database:CmsDatabase,selections:readonly ResolvedReferenceTargets[]):Promise<(entryGroup:string)=>ContentReferencePlan>{
 const prepared:PreparedSelection[]=[];
 for(const selection of selections)prepared.push(await prepare(database,selection,null));
 return entryGroup=>combine(prepared.map(selection=>compile(database,selection,entryGroup)));
}
