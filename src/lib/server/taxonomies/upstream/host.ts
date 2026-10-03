import type {CmsDatabase} from '../../database/contract.ts';
const databases=new WeakMap<object,CmsDatabase>();
export function registerTaxonomyDatabase(database:CmsDatabase){databases.set(database.db,database);}
export function taxonomyDatabase(db:object){return databases.get(db);}
