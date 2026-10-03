// Actual provider composition, with no substitute taxonomy or FTS storage.
import {SchemaRegistry} from '../database/registry.ts';
import {searchStatementPlanner} from '../search/schema-plan.ts';
import {applySeedTaxonomies} from '../taxonomies/seed.ts';
import type {SetupSeedDependencies} from './seed.ts';
export const setupSeedDependencies:SetupSeedDependencies={
 applyTaxonomies:applySeedTaxonomies,
 async enableSearch(database,slug){
  const registry=new SchemaRegistry(database),collection=await registry.getCollection(slug);
  if(!collection)throw new Error('Unknown seed search collection');
  const fields=await registry.listFields(collection.id);
  const plan=searchStatementPlanner(database,collection.id,fields);
  try{await plan.manager.enableSearch(slug);await database.atomicBatch(plan.statements);}
  finally{await plan.close();}
 }
};
