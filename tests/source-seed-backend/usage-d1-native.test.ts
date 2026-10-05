import {expect,it} from 'vitest';
import {sql,type Kysely} from 'kysely';
import {schemaAdminStorage} from '../helpers/schema-admin-storage.ts';
import {registerBlockDatabaseHost} from '../../src/lib/server/blocks/upstream/host.ts';
import {migrateCms} from '../../src/lib/server/database/migrations.ts';
import {SchemaRegistry} from '../../src/lib/server/database/registry.ts';
import {seedSourceDatabase} from '../../src/lib/server/seed/namespace.ts';
import {activateMediaUsageCapture} from '../../src/lib/server/blocks/upstream/media/usage/activation.ts';
import {MediaUsageRepository} from '../../src/lib/server/seed/d1-media-usage.ts';
import type {Database} from '../../src/lib/server/blocks/upstream/database/types.ts';
import type {MediaUsageSourceInput,MediaUsageOccurrenceInput} from '../../src/lib/server/blocks/upstream/database/repositories/media-usage.ts';

async function fixture(active=true) {
 const storage=await schemaAdminStorage('D1');
 try{
  await migrateCms(storage.database);seedSourceDatabase(storage.database);registerBlockDatabaseHost(storage.database);
  const db=storage.database.db as unknown as Kysely<Database>;
  if(active)await activateMediaUsageCapture(db,{writersDrained:true});
  await new SchemaRegistry(storage.database).createCollection({slug:'usage_posts',label:'Usage Posts'});
  const collection=(await new SchemaRegistry(storage.database).getCollection('usage_posts'))!;
  const stamp='2026-01-01T00:00:00.000Z';
  await sql`INSERT INTO ec_usage_posts(id,slug,status,version,created_at,updated_at) VALUES ('usage-entry','usage-entry','published',1,${stamp},${stamp})`.execute(db);
  const source:MediaUsageSourceInput={sourceKey:'content:usage_posts:usage-entry:columns',sourceType:'content',collectionId:collection.id,collectionSlug:collection.slug,contentId:'usage-entry',sourceVariant:'columns',sourceVersion:1,sourceUpdatedAt:stamp,sourceFingerprint:'media-usage-projection:v1:sha256:'+ 'a'.repeat(64),sourceCompleteness:'complete'};
  const occurrence:MediaUsageOccurrenceInput={fieldSlug:'hero',fieldPath:'hero',referenceType:'media',mediaId:'actual-media',provider:'local',providerAssetId:'actual-media'};
  return{storage,db,source,occurrence,repo:new MediaUsageRepository(db)};
 }catch(error){await storage.close();throw error;}
}
it('D1: returns the actual committed new source and current usage without a callback transaction',async()=>{
 const f=await fixture();try{
  const outcome=await f.repo.replaceSourceIfMatching(f.source,[f.occurrence],null).then(receipt=>({receipt,error:null}),error=>({receipt:null,error}));
  expect(outcome.error).toBeNull();expect(outcome.receipt).toEqual({replaced:true,unchanged:false,source:null});
  expect((await f.repo.findSource(f.source.sourceKey))?.currentGeneration).toBeTruthy();
  expect(await f.repo.findCurrentUsageByMediaId('actual-media')).toHaveLength(1);
  expect(await f.db.selectFrom('_cms_media_usage_generation_writes').select('lease_token').execute()).toEqual([]);
 }finally{await f.storage.close();}
},30000);
it('D1: preserves an unchanged projection and its actual generation',async()=>{
 const f=await fixture();try{
  await f.repo.replaceNewSourcesBatch([{source:f.source,occurrences:[f.occurrence]}]);
  const before=(await f.repo.findSource(f.source.sourceKey))!;expect(before).toBeTruthy();
  expect(await f.repo.replaceSourceIfMatching(f.source,[f.occurrence],before)).toEqual({replaced:false,unchanged:true,source:null});
  expect((await f.repo.findSource(f.source.sourceKey))?.currentGeneration).toBe(before.currentGeneration);
 }finally{await f.storage.close();}
},30000);
it('D1: replaces only the expected generation and reports the real current source after a stale attempt',async()=>{
 const f=await fixture();try{
  await f.repo.replaceNewSourcesBatch([{source:f.source,occurrences:[f.occurrence]}]);
  const before=(await f.repo.findSource(f.source.sourceKey))!;
  const changed={...f.source,sourceFingerprint:'media-usage-projection:v1:sha256:'+ 'b'.repeat(64)};
  const outcome=await f.repo.replaceSourceIfMatching(changed,[{...f.occurrence,mediaId:'actual-new-media',providerAssetId:'actual-new-media'}],before).then(receipt=>({receipt,error:null}),error=>({receipt:null,error}));
  expect(outcome.error).toBeNull();expect(outcome.receipt).toEqual({replaced:true,unchanged:false,source:null});
  const current=(await f.repo.findSource(f.source.sourceKey))!;expect(current.currentGeneration).not.toBe(before.currentGeneration);
  const stale=await f.repo.replaceSourceIfMatching({...changed,sourceFingerprint:'media-usage-projection:v1:sha256:'+ 'c'.repeat(64)},[],before);
  expect(stale).toEqual({replaced:false,unchanged:false,source:current});
  expect(await f.repo.findCurrentUsageByMediaId('actual-new-media')).toHaveLength(1);
 }finally{await f.storage.close();}
},30000);

it('D1: refreshes a real preactivation source and preserves no-op generations',async()=>{
 const f=await fixture(false);try{
  const outcome=await f.repo.replaceSourceIfMatching(f.source,[f.occurrence],null);
  expect(outcome).toEqual({replaced:true,unchanged:false,source:null});
  const before=(await f.repo.findSource(f.source.sourceKey))!;expect(before).toBeTruthy();
  expect(await f.repo.replaceSourceIfMatching(f.source,[f.occurrence],before)).toEqual({replaced:false,unchanged:true,source:null});
  const changed={...f.source,sourceFingerprint:'media-usage-projection:v1:sha256:'+ 'd'.repeat(64)};
  expect(await f.repo.replaceSourceIfMatching(changed,[],before)).toEqual({replaced:true,unchanged:false,source:null});
  const current=(await f.repo.findSource(f.source.sourceKey))!;expect(current.currentGeneration).not.toBe(before.currentGeneration);
  expect(await f.repo.replaceSourceIfMatching({...changed,sourceFingerprint:'media-usage-projection:v1:sha256:'+ 'e'.repeat(64)},[],before)).toEqual({replaced:false,unchanged:false,source:current});
  expect(await f.db.selectFrom('_cms_media_usage_generation_writes').select('lease_token').execute()).toEqual([]);
 }finally{await f.storage.close();}
},30000);
