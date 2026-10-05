// Native D1 storage specialization. Source Node methods stay in their immutable
// repository; fixed SQL and write leases remain owned by that same repository.
import type {Kysely} from 'kysely';
import {RawBindingD1Adapter} from '../database/d1.ts';
import {registeredSeedDatabaseOwner} from './namespace.ts';
import {registeredBylineDatabaseOwner} from '../bylines/storage.ts';
import {blockDatabaseHost} from '../blocks/upstream/host.ts';
import {MediaUsageRepository as SourceUsage,type MediaUsageSourceInput,type MediaUsageOccurrenceInput,type MediaUsageSource,type MediaUsageGuardedReplaceResult} from '../blocks/upstream/database/repositories/media-usage.ts';
import type {Database} from '../blocks/upstream/database/types.ts';

export class MediaUsageRepository extends SourceUsage {
 private readonly nativeD1:boolean;
 constructor(db:Kysely<Database>) {
  const nativeD1=db.getExecutor().adapter instanceof RawBindingD1Adapter;
  const owner=registeredSeedDatabaseOwner(db)??blockDatabaseHost(db)??registeredBylineDatabaseOwner(db as unknown as Parameters<typeof registeredBylineDatabaseOwner>[0]);
  if(nativeD1&&!owner)throw new Error('Native D1 media usage requires its actual registered database owner');
  super(nativeD1?owner!.db as unknown as Kysely<Database>:db);
  this.nativeD1=nativeD1;
 }
 override async replaceSourceIfMatching(source:MediaUsageSourceInput,occurrences:readonly MediaUsageOccurrenceInput[],expectedSource:MediaUsageSource|null):Promise<MediaUsageGuardedReplaceResult> {
  if(!this.nativeD1)return super.replaceSourceIfMatching(source,occurrences,expectedSource);
  if(expectedSource!==null&&await this.projectionMatchesExpectedSource(source,expectedSource))return{replaced:false,unchanged:true,source:null};
  const changed=expectedSource===null
   ?await this.replaceNewSourcesBatch([{source,occurrences}])
   :await this.replaceExistingSourcesBatch([{source,occurrences,expectedSource}]);
  const replaced=changed.has(source.sourceKey);
  return{replaced,unchanged:false,source:replaced?null:await this.findSource(source.sourceKey)};
 }
}
