// Actual Native domain constructors on the same registered owner. Node Source
// provider identities remain in providers.ts without D1 substitutions.
export * from './providers.ts';
export {MediaUsageRepository} from './d1-media-usage.ts';
import type {Kysely} from 'kysely';
import type {Database} from './upstream/database/types.ts';
import {seedDatabaseOwner,seedNativeBylines} from './namespace.ts';
import {BylineRepository as Byline} from '../bylines/repository.ts';
import {MediaRepository as Media} from '../general-media/index.ts';
import {RedirectRepository as Redirect} from '../redirects/repository.ts';
import {FTSManager as FTS} from '../content-picker/fts-manager.ts';
import {BlockTypeRegistry as Block} from '../blocks/upstream/schema/block-type-registry.ts';
import {registerBlockDatabaseHost} from '../blocks/upstream/host.ts';
export const BylineRepository=function(db:Kysely<Database>){return seedNativeBylines(db);} as unknown as new(db:Kysely<Database>)=>Byline;
export type BylineRepository=Byline;
export class MediaRepository extends Media {constructor(db:Kysely<Database>){super(seedDatabaseOwner(db));}}
export class RedirectRepository extends Redirect {constructor(db:Kysely<Database>){super(seedDatabaseOwner(db).db as unknown as ConstructorParameters<typeof Redirect>[0]);}}
export class FTSManager extends FTS {constructor(db:Kysely<Database>){super(seedDatabaseOwner(db).db as unknown as ConstructorParameters<typeof FTS>[0]);}}
export class BlockTypeRegistry extends Block {constructor(db:Kysely<Database>){const owner=seedDatabaseOwner(db);registerBlockDatabaseHost(owner);super(owner.db as unknown as ConstructorParameters<typeof Block>[0]);}}

import {markContentMediaUsageCollectionStale as stale,markContentMediaUsageCollectionStaleSafely as staleSafely} from '../blocks/upstream/media/usage/schema-invalidation.ts';
import {registeredSeedDatabaseOwner} from './namespace.ts';
import {registeredBylineDatabaseOwner} from '../bylines/storage.ts';
function actualOwner(db:Kysely<Database>){const owner=registeredSeedDatabaseOwner(db)??registeredBylineDatabaseOwner(db as unknown as Parameters<typeof registeredBylineDatabaseOwner>[0]);if(!owner)throw new Error('D1 seed invalidation requires its actual registered owner');return owner;}
export const markContentMediaUsageCollectionStale=(db:Kysely<Database>,...args:Parameters<typeof stale> extends [unknown,...infer A]?A:never)=>stale(actualOwner(db).db as unknown as Parameters<typeof stale>[0],...args);
export const markContentMediaUsageCollectionStaleSafely=(db:Kysely<Database>,...args:Parameters<typeof staleSafely> extends [unknown,...infer A]?A:never)=>staleSafely(actualOwner(db).db as unknown as Parameters<typeof staleSafely>[0],...args);
