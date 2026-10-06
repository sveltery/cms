import type { Kysely } from 'kysely';
import type { Database } from '../../database/types.ts';
import { NativeMediaUsageContentDependencies } from '../../../content-dependencies.ts';
export { contentRefreshKey,withContentUsageCollectionLock,CONTENT_MEDIA_USAGE_ADAPTER_ID,CONTENT_MEDIA_USAGE_COLLECTION_SCOPE } from '../../../../seed/upstream/media/usage/content-refresh.ts';
export type { ContentMediaUsageRefreshResult,ContentMediaUsageRefreshErrorCode } from '../../../../seed/upstream/media/usage/content-refresh.ts';
type Refresh=typeof import('../../../../seed/namespace.ts')['seedNativeRefreshContentMediaUsageForWorkBatch'];
export function refreshContentMediaUsageForWorkBatch(db:Kysely<Database>,...args:Parameters<Refresh> extends [unknown,...infer A]?A:never) {
  return new NativeMediaUsageContentDependencies(db).refreshWork(...args);
}
type AfterWrite=typeof import('../../../../seed/namespace.ts')['seedNativeRefreshContentMediaUsageAfterWrite'];
export function refreshContentMediaUsageAfterWrite(db:Kysely<Database>,...args:Parameters<AfterWrite> extends [unknown,...infer A]?A:never) {
  return new NativeMediaUsageContentDependencies(db).refreshAfterWrite(...args);
}
type Delete=typeof import('../../../../seed/namespace.ts')['seedNativeDeleteContentMediaUsage'];
export function deleteContentMediaUsage(db:Kysely<Database>,...args:Parameters<Delete> extends [unknown,...infer A]?A:never) {
  return new NativeMediaUsageContentDependencies(db).deleteContent(...args);
}
