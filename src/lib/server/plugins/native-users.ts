import type { Kysely } from 'kysely';
import { UserRepository as CanonicalUserRepository } from '../users/repository.ts';
import type { Database } from './database-types.ts';
import { pluginDatabaseOwner } from './database.ts';
export class UserRepository extends CanonicalUserRepository {
  constructor(db: Kysely<Database>) { super(pluginDatabaseOwner(db)); }
}
