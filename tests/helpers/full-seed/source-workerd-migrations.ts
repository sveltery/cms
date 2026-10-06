import type {Kysely} from 'kysely';
import {migrateCms} from '../../../src/lib/server/database/migrations.ts';
import {registeredBylineDatabaseOwner} from '../../../src/lib/server/bylines/storage.ts';
/** The Original explicit migration call operates the already constructed owner. */
export async function runMigrations(db:Kysely<any>):Promise<void>{
 const owner=registeredBylineDatabaseOwner(db);
 if(!owner)throw new Error('Original seed Workerd migration requires its exact registered owner');
 await migrateCms(owner);
}
