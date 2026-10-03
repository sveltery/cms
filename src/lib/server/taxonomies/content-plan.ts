import {sql,type CompiledQuery} from 'kysely';
import {ulid} from 'ulidx';
import {CmsError,type CmsDatabase} from '../database/contract.ts';
import {TaxonomyRepository} from './upstream/database/repositories/taxonomy.ts';
import {registerTaxonomyDatabase} from './upstream/host.ts';
import {invalidateTermCache} from './upstream/taxonomies/index.ts';

// Native compiled adapter for assignTaxonomies in core/api/handlers/content.ts
// lines2817–2857, pinned913cb1bb9b7f08c3ff0d258b4420e53835b6a58e.
// Copyright2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
// All reads/validation happen before one complete content/revision/pivot batch.
export interface ContentTaxonomyPlan {queries(entryGroup:string):CompiledQuery[];invalidate():void}
export async function contentTaxonomyPlan(database:CmsDatabase,collection:string,locale:string|undefined,value:unknown):Promise<ContentTaxonomyPlan|null> {
 if(!value)return null;
 if(typeof value!=='object'||Array.isArray(value))throw new CmsError('VALIDATION_ERROR','taxonomies must be an object');
 registerTaxonomyDatabase(database);const db=database.db as any,repo=new TaxonomyRepository(db);
 const assignments:{name:string;terms:{id:string;group:string;slug:string;locale:string}[]}[]=[];
 for(const[name,slugs]of Object.entries(value)){
  if(!Array.isArray(slugs))throw new CmsError('VALIDATION_ERROR',`taxonomies.${name} must be an array of term slugs`);
  const terms=[];
  for(const slug of slugs){
   if(typeof slug!=='string'||slug.length===0)throw new CmsError('VALIDATION_ERROR',`taxonomies.${name} contains a non-string or empty slug`);
   const term=await repo.findBySlug(name,slug,locale);
   if(!term)throw new CmsError('VALIDATION_ERROR',`Unknown taxonomy term: ${name}='${slug}'${locale?` (locale '${locale}')`:''}`);
   terms.push({id:term.id,group:term.translationGroup??term.id,slug:term.slug,locale:term.locale});
  }
  assignments.push({name,terms});
 }
 return{
  queries(entryGroup){
   const queries:CompiledQuery[]=[];
   for(const{name,terms}of assignments){
    // Guards catch deletion/re-grouping between slug resolution and the write.
    // 16 terms keep each statement below the actual D1 parameter budget.
    for(let offset=0;offset<terms.length;offset+=16){const token=ulid();const checks=terms.slice(offset,offset+16).map(term=>sql`EXISTS(SELECT 1 FROM taxonomies WHERE id=${term.id} AND name=${name} AND slug=${term.slug} AND locale=${term.locale} AND coalesce(translation_group,id)=${term.group})`);queries.push(sql`INSERT INTO _cms_guards(token,pass) SELECT ${token},CASE WHEN ${sql.join(checks,sql` AND `)} THEN 1 ELSE 0 END`.compile(db),sql`DELETE FROM _cms_guards WHERE token=${token}`.compile(db));}
    queries.push(sql`DELETE FROM content_taxonomies WHERE collection=${collection} AND entry_id=${entryGroup} AND taxonomy_id IN(SELECT coalesce(translation_group,id) FROM taxonomies WHERE name=${name})`.compile(db));
    const groups=[...new Set(terms.map(term=>term.group))];
    for(let offset=0;offset<groups.length;offset+=30)queries.push(db.insertInto('content_taxonomies').values(groups.slice(offset,offset+30).map(taxonomy_id=>({collection,entry_id:entryGroup,taxonomy_id}))).onConflict((oc:any)=>oc.doNothing()).compile());
   }
   return queries;
  },
  invalidate(){if(assignments.length)invalidateTermCache();}
 };
}
