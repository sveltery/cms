// Source content duplicate coupling: outgoing edges keep their source order;
// child-side fields retain their backlinks. Same existing relation plans only.
// EmDash913cb1bb9b7f08c3ff0d258b4420e53835b6a58e content.ts1745–1772.
// Copyright2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
import {sql,type Kysely} from 'kysely';
import {ulid} from 'ulidx';
import {CmsError,type CmsDatabase} from '../database/contract.ts';
import type {Database} from '../database/lifecycle/upstream/database/types.ts';
import {RelationRepository,type Relation} from './repository.ts';
import {referenceFieldConstraints} from './validate-references.ts';
import {prepareContentReferenceCreates,type ContentReferencePlan} from './content-plan.ts';
import {relationGuard,addPlan} from './atomic.ts';
function refusal(group:string,farSide:'parent'|'child'):never{
 throw new CmsError('VALIDATION_ERROR',`Entry '${group}' already has the maximum number of ${farSide} entries on this relation.`);
}
export async function prepareContentReferenceCopy(database:CmsDatabase,collection:string,from:string):Promise<(to:string)=>ContentReferencePlan>{
 const db=database.db as unknown as Kysely<Database>;const repo=new RelationRepository(database);
 const original=await db.selectFrom('_cms_content_references').selectAll().where('parent_group','=',from).execute();
 const outgoing=new Map<string,typeof original>();for(const edge of original){const rows=outgoing.get(edge.relation_id)??[];rows.push(edge);outgoing.set(edge.relation_id,rows);}
 const groups:{relation:Relation;rows:typeof original;token:string}[]=[];
 for(const [id,rows] of outgoing){
  const relation=await repo.findById(id);if(!relation)throw new Error('Reference relation no longer exists');
  if(relation.maxParentsPerChild!==null)for(const row of rows)if(await repo.countParents(id,row.child_group)>=relation.maxParentsPerChild)refusal(row.child_group,'parent');
  groups.push({relation,rows,token:`content-copy:${ulid()}`});
 }
 const incoming=[];
 for(const field of (await referenceFieldConstraints(db,collection)).values()){
  if(field.relationSide!=='child')continue;
  const parents=await repo.getParents(field.relation,from);if(!parents.length)continue;
  const relation=await repo.findBySlug(field.relation);if(!relation)throw new Error('Reference relation no longer exists');
  if(relation.maxChildrenPerParent!==null)for(const parent of parents)if(await repo.countChildren(field.relation,parent.parentGroup)>=relation.maxChildrenPerParent)refusal(parent.parentGroup,'child');
  incoming.push({relation:relation.id,side:'child' as const,groups:parents.map(parent=>parent.parentGroup)});
 }
 const childPlan=await prepareContentReferenceCreates(database,incoming);
 const now=new Date().toISOString();
 return to=>{
  const child=childPlan(to);
  return{before:[...groups.map(group=>relationGuard(db,group.relation,group.token)),...child.before],
   after:[...groups.flatMap(({relation,rows,token})=>addPlan(db,rows.map(row=>({...row,id:ulid(),parent_group:to,created_at:now})),'child',relation.maxParentsPerChild,token)),...child.after],
   cleanup:[...groups.map(group=>sql`DELETE FROM _cms_guards WHERE token=${group.token}`.compile(db)),...child.cleanup],
   touchedCollections:[...new Set([...groups.flatMap(group=>[group.relation.parentCollection,group.relation.childCollection]),...child.touchedCollections])]};
 };
}
