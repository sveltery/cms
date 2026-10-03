import type {Kysely} from 'kysely';
import type {Database} from '../../src/lib/server/media/source/database/types.ts';
import {SchemaRegistry as NativeRegistry} from '../../src/lib/server/database/registry.ts';
import {mediaSourceDatabase} from './media-source-database.ts';
/** Fixture import adaptation; every field/collection is persisted by the actual native registry. */
export class SchemaRegistry extends NativeRegistry {constructor(db:Kysely<Database>){super(mediaSourceDatabase(db));}}
