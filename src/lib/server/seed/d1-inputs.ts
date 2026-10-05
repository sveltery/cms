import type {Kysely} from 'kysely';
import type {Database} from './upstream/database/types.ts';
import type {SeedContentEntry,SeedField} from './types.ts';
import type {CreateFieldInput} from '../schema/types.ts';
import {SchemaRegistry} from './registry.ts';
import {createFieldRelation} from './field-relations.ts';
import {TaxonomyRepository} from './providers.ts';
export function resolveNativeBylines(entry:SeedContentEntry,ids:Map<string,string>,collection:string,isUpdate:boolean){
 if(!entry.bylines?.length)return isUpdate?[]:undefined;
 const credits=entry.bylines.map(credit=>{const bylineId=ids.get(credit.byline);return bylineId?{bylineId,roleLabel:credit.roleLabel??null}:null;}).filter((credit):credit is {bylineId:string;roleLabel:string|null}=>Boolean(credit));
 if(credits.length!==entry.bylines.length)console.warn(`content.${collection}.${entry.slug??entry.id}: one or more byline refs could not be resolved`);
 return credits.length||isUpdate?credits:undefined;
}
export async function resolveNativeTaxonomyTerms(db:Kysely<Database>,entry:SeedContentEntry){
 const repo=new TaxonomyRepository(db),terms:string[]=[];
 for(const [name,slugs]of Object.entries(entry.taxonomies??{}))for(const slug of slugs){const term=await repo.findBySlug(name,slug);if(term)terms.push(term.id);}
 return terms;
}
/** Native fixed domains preserve Source D1's sequential relation/field publication. */
export async function createNativeReferenceField(db:Kysely<Database>,collection:string,input:CreateFieldInput,target:string,field:SeedField){
 const relation=await createFieldRelation(db,collection,field.slug,field.label,target,field.validation?.multiple?null:1);
 await new SchemaRegistry(db).createField(collection,{...input,validation:{...field.validation,relation:relation.slug,relationSide:'parent'}});
}
