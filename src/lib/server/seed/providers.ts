import type {Kysely} from 'kysely';
import type {Database} from './upstream/database/types.ts';
import {BylineRepository as Byline} from '../bylines/repository.ts';
import {RelationRepository as Relation} from '../relations/repository.ts';
import {TaxonomyRepository as Taxonomy} from '../taxonomies/repository.ts';
import {RedirectRepository as Redirect} from '../redirects/repository.ts';
import {BlockTypeRegistry as Block} from '../blocks/upstream/schema/block-type-registry.ts';
import {FTSManager as FTS} from '../content-picker/fts-manager.ts';
import {MediaUsageRepository as Usage} from '../blocks/upstream/database/repositories/media-usage.ts';
import {setReferenceSelection as referenceSelection} from '../relations/handlers.ts';
import {findTaxonomyStructure as findStructure,saveTaxonomyStructure as saveStructure} from '../taxonomies/definitions.ts';
import {invalidateContentMediaUsageSchemaChange as invalidateSchema,markContentMediaUsageCollectionStale as markStale,markContentMediaUsageCollectionStaleSafely as markStaleSafely} from '../blocks/upstream/media/usage/schema-invalidation.ts';
import {publishRedirectChanges as publishChanges} from '../redirects/artifacts.ts';
import {resolveBlockTypes as blockTypes,normalizeBlocksData as blocksData} from '../blocks/upstream/schema/block-values.ts';
import {jsonTextValues as textValues} from '../blocks/upstream/database/json-recordset.ts';

// The registered production query handle is both the real Source logical
// descriptor and the canonical physical descriptor. These type-only aliases
// preserve exact function/class identity; they install no wrapper or provider.
type Constructor<T extends abstract new (...args:never[])=>unknown> = new(db:Kysely<Database>)=>InstanceType<T>;
type SourceQuery<T> = T extends (db:never,...args:infer A)=>infer R ? (db:Kysely<Database>,...args:A)=>R : never;
export const BylineRepository=Byline as unknown as Constructor<typeof Byline>;
export const RelationRepository=Relation as unknown as Constructor<typeof Relation>;
export type {Relation} from '../relations/repository.ts';
export const TaxonomyRepository=Taxonomy as unknown as Constructor<typeof Taxonomy>;
export const RedirectRepository=Redirect as unknown as Constructor<typeof Redirect>;
export const BlockTypeRegistry=Block as unknown as Constructor<typeof Block>;
export const FTSManager=FTS as unknown as Constructor<typeof FTS>;
export const MediaUsageRepository=Usage as unknown as Constructor<typeof Usage>;
export type {MediaUsageExistingSourceProjection,MediaUsageNewSourceProjection,MediaUsageSource,MediaUsageOccurrenceInput,MediaUsageSourceInput} from '../blocks/upstream/database/repositories/media-usage.ts';
export const setReferenceSelection=referenceSelection as unknown as SourceQuery<typeof referenceSelection>;
export const findTaxonomyStructure=findStructure as unknown as SourceQuery<typeof findStructure>;
export const saveTaxonomyStructure=saveStructure as unknown as SourceQuery<typeof saveStructure>;
export const invalidateContentMediaUsageSchemaChange=invalidateSchema as unknown as SourceQuery<typeof invalidateSchema>;
export const markContentMediaUsageCollectionStale=markStale as unknown as SourceQuery<typeof markStale>;
export const markContentMediaUsageCollectionStaleSafely=markStaleSafely as unknown as SourceQuery<typeof markStaleSafely>;
export const publishRedirectChanges=publishChanges as unknown as SourceQuery<typeof publishChanges>;
export const resolveBlockTypes=blockTypes as unknown as SourceQuery<typeof blockTypes>;
export const normalizeBlocksData=blocksData as unknown as SourceQuery<typeof blocksData>;
export const jsonTextValues=textValues as unknown as SourceQuery<typeof textValues>;
export {CONTENT_MEDIA_USAGE_ADAPTER_ID,CONTENT_MEDIA_USAGE_COLLECTION_SCOPE} from '../blocks/upstream/media/usage/schema-invalidation.ts';

export type BylineRepository=InstanceType<typeof Byline>;
export type TaxonomyRepository=InstanceType<typeof Taxonomy>;
export type MediaUsageRepository=InstanceType<typeof Usage>;
