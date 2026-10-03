// Native public taxonomy query host. Source getEntriesByTerm delegates here;
// this is a narrow SQL host substitution, not the complete Astro query engine.
import {sql} from 'kysely';
import {getDb} from './loader.ts';
import {taxonomyDatabase} from './host.ts';
import {SchemaRegistry} from '../../database/registry.ts';
import {ContentRepository} from './database/repositories/content.ts';
import {TaxonomyRepository} from './database/repositories/taxonomy.ts';
import {identifier,localeInput,parse,tableName} from '../../database/validation.ts';
import {CmsError} from '../../database/contract.ts';
import {resolveLocale} from './i18n/resolve.ts';
export interface CacheHint {tags?:string[];lastModified?:Date}
export async function getEmDashCollection(collection:string,options:Record<string,unknown>={}) {
 const db=await getDb(),database=taxonomyDatabase(db);if(!database)throw new CmsError('MIGRATION_REQUIRED');
 const type=parse(identifier,collection),locale=parse(localeInput,resolveLocale(typeof options.locale==='string'?options.locale:undefined));
 if(!await new SchemaRegistry(database).getCollectionWithFields(type))throw new CmsError('NOT_FOUND');
 const where=options.where??{};if(typeof where!=='object'||where===null||Array.isArray(where))throw new CmsError('VALIDATION_ERROR');
 const predicates=[];
 for(const[name,slug]of Object.entries(where)){
  parse(identifier,name);if(typeof slug!=='string')throw new CmsError('VALIDATION_ERROR');
  const term=await new TaxonomyRepository(db).findBySlug(name,slug,locale);
  if(!term)return{entries:[]};
  predicates.push(sql`EXISTS(SELECT 1 FROM content_taxonomies p WHERE p.collection=${type} AND p.entry_id=coalesce(c.translation_group,c.id) AND p.taxonomy_id=${term.translationGroup??term.id})`);
 }
 const rows=(await sql<Record<string,unknown>>`SELECT c.* FROM ${sql.ref(tableName(type))} c WHERE c.locale=${locale} AND c.status='published' AND c.deleted_at IS NULL ${predicates.length?sql`AND ${sql.join(predicates,sql` AND `)}`:sql``} ORDER BY c.created_at DESC,c.id DESC`.execute(db)).rows;
 const repository=new ContentRepository(db);return{entries:rows.map(row=>repository.mapRow(type,row))};
}
