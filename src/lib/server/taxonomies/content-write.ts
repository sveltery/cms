// Taxonomy slug-map semantics from whole pinned Source content.ts2806–2860.
// Copyright2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
import {sql,type CompiledQuery,type Kysely} from 'kysely';
import {ulid} from 'ulidx';
import type {CmsDatabase} from '../database/contract.ts';
import {EmDashValidationError} from '../database/lifecycle/upstream/database/repositories/types.ts';
import type {Database} from './database-types.ts';

export interface ResolvedTaxonomySelection {
 readonly name:string;
 readonly terms:readonly {id:string;slug:string;locale:string;translationGroup:string|null}[];
}
async function taxonomyRepository(db:Kysely<Database>){
 const {TaxonomyRepository}=await import('./repository.ts');
 return new TaxonomyRepository(db);
}
/** Reads/validation only; every Native write remains in its actual content batch. */
export async function resolveTaxonomySlugMap(db:Kysely<Database>,taxonomies:Record<string,unknown>,locale:string|undefined):Promise<ResolvedTaxonomySelection[]> {
 const repository=await taxonomyRepository(db);const selections:ResolvedTaxonomySelection[]=[];
 for(const [name,slugs] of Object.entries(taxonomies)) {
  if(!Array.isArray(slugs))throw new EmDashValidationError(`taxonomies.${name} must be an array of term slugs`);
  const terms:ResolvedTaxonomySelection['terms'][number][]=[];
  for(const slug of slugs) {
   if(typeof slug!=='string'||slug.length===0)throw new EmDashValidationError(`taxonomies.${name} contains a non-string or empty slug`);
   const term=await repository.findBySlug(name,slug,locale);
   if(!term)throw new EmDashValidationError(`Unknown taxonomy term: ${name}='${slug}'${locale?` (locale '${locale}')`:''}`);
   terms.push({id:term.id,slug:term.slug,locale:term.locale,translationGroup:term.translationGroup});
  }
  selections.push({name,terms});
 }
 return selections;
}
/** Source-only genuine transaction hosts use the same real Native taxonomy repository. */
export async function applyResolvedTaxonomySelections(db:Kysely<Database>,collection:string,id:string,selections:readonly ResolvedTaxonomySelection[]):Promise<void> {
 const repository=await taxonomyRepository(db);
 for(const selection of selections)await repository.setTermsForEntry(collection,id,selection.name,selection.terms.map(term=>term.id));
}
/** Explicit fixed plan on the canonical physical owner. No callback-transaction emulation. */
export function contentTaxonomyStatements(database:CmsDatabase,collection:string,entryGroup:string|null,selections:readonly ResolvedTaxonomySelection[]):{before:CompiledQuery[];after:CompiledQuery[];cleanup:CompiledQuery[]} {
 const db=database.db;const before:CompiledQuery[]=[];const after:CompiledQuery[]=[];const cleanup:CompiledQuery[]=[];
 if(entryGroup===null)return {before,after,cleanup};
 for(const selection of selections) {
  const distinctTerms=new Map(selection.terms.map(term=>[term.id,term]));
  for(const term of distinctTerms.values()) {
   const token=ulid();
   before.push(sql`INSERT INTO _cms_guards(token,pass) SELECT ${token},CASE WHEN EXISTS(
     SELECT 1 FROM _cms_taxonomies WHERE id=${term.id} AND name=${selection.name} AND slug=${term.slug} AND locale=${term.locale}
     AND ${term.translationGroup===null?sql`translation_group IS NULL`:sql`translation_group=${term.translationGroup}`}
    )THEN 1 ELSE 0 END`.compile(db));
   cleanup.push(sql`DELETE FROM _cms_guards WHERE token=${token}`.compile(db));
  }
  const groups=[...new Set(selection.terms.flatMap(term=>term.translationGroup===null?[]:[term.translationGroup]))];
  // A JSON row set keeps the fixed deletion below D1's binding cap.
  // The deletion touches only the explicitly named taxonomy.
  after.push(sql`DELETE FROM _cms_content_taxonomies WHERE collection=${collection} AND entry_id=${entryGroup}
   AND taxonomy_id IN(SELECT translation_group FROM _cms_taxonomies WHERE name=${selection.name})
   ${groups.length?sql`AND taxonomy_id NOT IN(SELECT value FROM json_each(${JSON.stringify(groups)}))`:sql``}`.compile(db));
  for(let start=0;start<groups.length;start+=32) {
   const rows=groups.slice(start,start+32).map(taxonomy_id=>({collection,entry_id:entryGroup,taxonomy_id}));
   after.push(db.insertInto('_cms_content_taxonomies').values(rows).onConflict(conflict=>conflict.doNothing()).compile());
  }
 }
 return {before,after,cleanup};
}
/** Guard the actual content INSERT before any assignment can be persisted. */
export function newContentTaxonomyStatements(database:CmsDatabase,collection:string,entry:{id:string;translationGroup:string;locale:string},selections:readonly ResolvedTaxonomySelection[]) {
 const plan=contentTaxonomyStatements(database,collection,entry.translationGroup,selections);
 const token=ulid();
 plan.after.unshift(sql`INSERT INTO _cms_guards(token,pass) SELECT ${token},CASE WHEN changes()=1 AND EXISTS(
  SELECT 1 FROM ${sql.ref(`ec_${collection}`)} WHERE id=${entry.id} AND translation_group=${entry.translationGroup}
  AND locale=${entry.locale} AND deleted_at IS NULL AND version=1
 )THEN 1 ELSE 0 END`.compile(database.db));
 plan.cleanup.push(sql`DELETE FROM _cms_guards WHERE token=${token}`.compile(database.db));
 return plan;
}
export async function completeContentTaxonomies(selections:readonly ResolvedTaxonomySelection[]):Promise<void> {
 if(selections.length){const {invalidateTermCache}=await import('./index.ts');invalidateTermCache();}
}
