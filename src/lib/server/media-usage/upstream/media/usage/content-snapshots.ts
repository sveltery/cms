import type { Kysely } from 'kysely';
import type { Database } from '../../database/types.ts';
import { NativeMediaUsageContentDependencies } from '../../../content-dependencies.ts';
export { CONTENT_SOURCE_SCHEMA_VERSION } from '../../../../seed/upstream/media/usage/content-snapshots.ts';
export type { ContentMediaUsageSnapshot,LoadContentMediaUsageSnapshotsResult } from '../../../../seed/upstream/media/usage/content-snapshots.ts';
type Load=typeof import('../../../../seed/upstream/media/usage/content-snapshots.ts')['loadContentMediaUsageSnapshots'];
export function loadContentMediaUsageSnapshots(db:Kysely<Database>,...args:Parameters<Load> extends [unknown,...infer A]?A:never) {
  return new NativeMediaUsageContentDependencies(db).snapshots(...args);
}
