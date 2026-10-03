import type {CmsDatabase} from '../../database/contract.ts';
const adapters=new WeakMap<object,CmsDatabase>();
const databases=new WeakMap<object,CmsDatabase>();
export function registerTaxonomyDatabase(database:CmsDatabase){databases.set(database.db,database);adapters.set(database.db.getExecutor().adapter,database);}
export function taxonomyDatabase(db:object){return databases.get(db)??adapters.get((db as any).getExecutor?.().adapter);}
