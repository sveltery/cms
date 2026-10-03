import {sql,type CompiledQuery,type Kysely,type QueryResult} from 'kysely';
import {taxonomyDatabase} from './upstream/host.ts';
/** Compile complete plans before calling the required real adapter batch. */
export async function atomicTaxonomyQueries(db:Kysely<any>,queries:readonly CompiledQuery[]):Promise<readonly QueryResult<unknown>[]> {
 if(!queries.length)return[];
 // Historical source fixtures may already hold a real SQLite transaction.
 // Execute inside it; never emulate or fall back to a bare callback on D1.
 if(db.isTransaction){const results=[];for(const query of queries)results.push(await db.executeQuery(query));return results;}
 const database=taxonomyDatabase(db);if(!database)throw new Error('Taxonomy write requires a registered native atomic database');
 return database.atomicBatch(queries);
}

/** Native compilation of the pinned saveTaxonomyStructure write sequence. */
export function taxonomyStructureQueries(db:Kysely<any>,name:string,groupId:string,structure:{hierarchical:boolean;collections:string[]},overwrite:Partial<{hierarchical:boolean;collections:string[]}>=structure):CompiledQuery[] {
 const changes:{hierarchical?:number;collections?:string}={};
 if(overwrite.hierarchical!==undefined)changes.hierarchical=overwrite.hierarchical?1:0;
 if(overwrite.collections!==undefined)changes.collections=JSON.stringify([...new Set(overwrite.collections)]);
 return [
  db.insertInto('_cms_taxonomy_def_groups').values({id:groupId,name,hierarchical:structure.hierarchical?1:0,collections:JSON.stringify([...new Set(structure.collections)])}).onConflict(oc=>Object.keys(changes).length?oc.column('name').doUpdateSet(changes):oc.column('name').doNothing()).compile(),
  sql`UPDATE _cms_taxonomy_defs SET hierarchical=(SELECT hierarchical FROM _cms_taxonomy_def_groups WHERE name=${name}),collections=(SELECT collections FROM _cms_taxonomy_def_groups WHERE name=${name}),translation_group=(SELECT id FROM _cms_taxonomy_def_groups WHERE name=${name}) WHERE name=${name}`.compile(db)
 ];
}
