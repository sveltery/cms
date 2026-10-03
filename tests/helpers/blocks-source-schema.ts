import type {Kysely} from 'kysely';
import {SchemaRegistry as NativeRegistry} from '../../src/lib/server/database/registry.ts';
import {sourceBlocksContext} from './blocks-source-database.ts';
export class SchemaRegistry extends NativeRegistry {constructor(db:Kysely<any>){super(sourceBlocksContext(db).database);}}
