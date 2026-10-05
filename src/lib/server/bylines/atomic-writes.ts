import type {CompiledQuery,Kysely,QueryResult} from 'kysely';
import type {Database} from './database-types.ts';
import {bylineDatabaseOwner} from './storage.ts';
/** Actual fixed SQL statements on the existing owner; never emulate a write. */
export async function executeBylineWrites(db:Kysely<Database>, statements:readonly CompiledQuery[]):Promise<readonly QueryResult<unknown>[]> {
 if(statements.length===0)return [];
 if(db.isTransaction){const results=[];for(const statement of statements)results.push(await db.executeQuery(statement));return results;}
 return bylineDatabaseOwner(db).atomicBatch(statements);
}
