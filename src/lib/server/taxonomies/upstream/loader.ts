import type {Kysely} from 'kysely';
import type {Database} from './database/types.ts';
import {getRequestContext} from './request-context.ts';
export async function getDb():Promise<Kysely<Database>> {
 const db=getRequestContext()?.db;
 if(!db)throw new Error('Taxonomy database is unavailable outside a trusted request context');
 return db as Kysely<Database>;
}
export function resetTaxonomyNamesCache():void {}
