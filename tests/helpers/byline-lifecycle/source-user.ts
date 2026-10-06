import {UserRepository as NativeUserRepository} from '../../../src/lib/server/users/repository.ts';
import {registeredBylineDatabaseOwner} from '../../../src/lib/server/bylines/storage.ts';
import type {Kysely} from 'kysely';
import type {Database} from '../../../src/lib/server/bylines/database-types.ts';
/** Constructor transport only: actual canonical identity/profile storage. */
export class UserRepository extends NativeUserRepository {
 constructor(db:Kysely<Database>){
  const owner=registeredBylineDatabaseOwner(db);
  if(!owner)throw new Error('Source user fixture requires the actual registered owner');
  super(owner);
 }
}
