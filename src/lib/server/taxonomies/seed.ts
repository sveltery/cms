// Taxonomy definition portion of seed/apply.ts:135–164,550–639 at EmDash
// 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e. Copyright 2026 Cloudflare Inc.
// MIT; notices/emdash-MIT.txt. Native fixed-query batch host adaptation.
import {sql,type CompiledQuery} from 'kysely';
import {ulid} from 'ulidx';
import {CmsError,type CmsDatabase} from '../database/contract.ts';
import {identifier,parse} from '../database/validation.ts';
import {getI18nConfig,resolveConfiguredLocale} from './upstream/i18n/config.ts';
import {invalidateTaxonomyDefsCache} from './upstream/taxonomies/index.ts';
import {parseTaxonomyCollections} from './upstream/database/repositories/taxonomy-def.ts';
export interface SeedTaxonomyDefinition {id?:string;name:string;label:string;labelSingular?:string;hierarchical?:boolean;collections?:string[];locale?:string;translationOf?:string}
export type SeedTaxonomyConflict='skip'|'update'|'error';
const builtins=new Map([
 ['taxdef_category',{label:'Categories',label_singular:'Category',hierarchical:1,collections:'["posts"]'}],
 ['taxdef_tag',{label:'Tags',label_singular:'Tag',hierarchical:0,collections:'["posts"]'}]
]);
type Row={id:string;name:string;label:string;label_singular:string|null;hierarchical:number;collections:string|null;locale:string;translation_group:string|null};
const snapshot=()=>sql<{snapshot:string}>`SELECT json_group_array(json_array(id,name,label,label_singular,hierarchical,collections,locale,translation_group)) AS snapshot FROM (SELECT * FROM _cms_taxonomy_defs ORDER BY id)`;
/** Apply actual definition/group rows; no term/content seed engine is implied. */
export async function applySeedTaxonomies(database:CmsDatabase,definitions:readonly SeedTaxonomyDefinition[],onConflict:SeedTaxonomyConflict='skip') {
 const db=database.db as any;
 if(!['skip','update','error'].includes(onConflict))throw new CmsError('VALIDATION_ERROR');
 const expected=(await snapshot().execute(db)).rows[0].snapshot;
 const rows:Row[]=await db.selectFrom('_cms_taxonomy_defs').selectAll().orderBy('id').execute();
 const groups:Map<string,{id:string;hierarchical:number;collections:string}>=new Map((await db.selectFrom('_cms_taxonomy_def_groups').selectAll().execute()).map((row:any)=>[row.name,row]));
 const untouched=new Set(rows.filter(row=>{const standard=builtins.get(row.id);return standard&&row.label===standard.label&&row.label_singular===standard.label_singular&&row.hierarchical===standard.hierarchical&&row.collections===standard.collections;}).map(row=>row.id));
 const token=ulid(),queries:CompiledQuery[]=[sql`INSERT INTO _cms_guards(token,pass) SELECT ${token},CASE WHEN (${snapshot()})=${expected} THEN 1 ELSE 0 END`.compile(db)];
 const result={created:0,updated:0,skipped:0};
 // Definitions of a structure precede its translated label variants.
 const ordered=[...definitions.filter(value=>!value.translationOf),...definitions.filter(value=>value.translationOf)];
 for(const definition of ordered){
  const name=parse(identifier,definition.name),locale=resolveConfiguredLocale(definition.locale??getI18nConfig()?.defaultLocale??'en');
  if(typeof definition.label!=='string'||definition.label.length===0)throw new CmsError('VALIDATION_ERROR');
  if(definition.labelSingular!==undefined&&typeof definition.labelSingular!=='string')throw new CmsError('VALIDATION_ERROR');
  if(definition.hierarchical!==undefined&&typeof definition.hierarchical!=='boolean')throw new CmsError('VALIDATION_ERROR');
  if(definition.collections!==undefined&&!Array.isArray(definition.collections))throw new CmsError('VALIDATION_ERROR');
  for(const collection of definition.collections??[])parse(identifier,collection);
  const defsOfName=rows.filter(row=>row.name===name),existing=defsOfName.find(row=>row.locale===locale);
  const unclaimed=existing!==undefined&&untouched.has(existing.id);
  if(existing&&onConflict==='error'&&!unclaimed)throw new CmsError('CONFLICT',`Conflict: taxonomy "${name}" (${locale}) already exists`);
  const replaces=onConflict==='update'||unclaimed;
  const currentGroup=groups.get(name);
  const first=defsOfName[0];
  const existingStructure=first?{id:first.translation_group??first.id,hierarchical:currentGroup?.hierarchical??first.hierarchical,collections:currentGroup?.collections??first.collections}:undefined;
  const replacesStructure=replaces||defsOfName.every(row=>untouched.has(row.id));
  const writesStructure=!existingStructure||(replacesStructure&&!definition.translationOf);
  const hierarchical=writesStructure?(definition.hierarchical??existingStructure?.hierarchical===1):existingStructure!.hierarchical===1;
  const collections=writesStructure?[...new Set(definition.collections??parseTaxonomyCollections(existingStructure?.collections??null))]:parseTaxonomyCollections(existingStructure!.collections);
  const id=existing?.id??ulid(),groupId=currentGroup?.id??existingStructure?.id??id;
  if(writesStructure){
   const structure={id:groupId,name,hierarchical:hierarchical?1:0,collections:JSON.stringify(collections)};
   queries.push(db.insertInto('_cms_taxonomy_def_groups').values(structure).onConflict((oc:any)=>oc.column('name').doUpdateSet({hierarchical:structure.hierarchical,collections:structure.collections})).compile());
   queries.push(sql`UPDATE _cms_taxonomy_defs SET hierarchical=(SELECT hierarchical FROM _cms_taxonomy_def_groups WHERE name=${name}),collections=(SELECT collections FROM _cms_taxonomy_def_groups WHERE name=${name}),translation_group=(SELECT id FROM _cms_taxonomy_def_groups WHERE name=${name}) WHERE name=${name}`.compile(db));
   groups.set(name,structure);for(const row of defsOfName){row.hierarchical=structure.hierarchical;row.collections=structure.collections;row.translation_group=groupId;}
  }
  if(existing){
   if(replaces){queries.push(db.updateTable('_cms_taxonomy_defs').set({label:definition.label,label_singular:definition.labelSingular??null}).where('id','=',id).compile());existing.label=definition.label;existing.label_singular=definition.labelSingular??null;result.updated++;}else result.skipped++;
  }else{
   const row={id,name,label:definition.label,label_singular:definition.labelSingular??null,hierarchical:hierarchical?1:0,collections:JSON.stringify(collections),locale,translation_group:groupId};
   queries.push(db.insertInto('_cms_taxonomy_defs').values(row).compile());rows.push(row);result.created++;
  }
 }
 queries.push(sql`DELETE FROM _cms_guards WHERE token=${token}`.compile(db));
 try{await database.atomicBatch(queries);}catch(error){if(error instanceof Error&&/CHECK constraint failed: pass = 1|UNIQUE constraint failed/.test(error.message))throw new CmsError('CONFLICT');throw error;}
 invalidateTaxonomyDefsCache();return result;
}
export const applySeedTaxonomy=(database:CmsDatabase,definition:SeedTaxonomyDefinition,onConflict:SeedTaxonomyConflict='skip')=>applySeedTaxonomies(database,[definition],onConflict);
