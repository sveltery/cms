import type { Kysely } from 'kysely';
import type { Database } from '../../database/types.ts';
import { NativeMediaUsageContentDependencies } from '../../../content-dependencies.ts';
export { buildContentMediaUsageFieldFingerprint,MediaUsageFieldDiscoveryError } from '../../../../seed/upstream/media/usage/content-fields.ts';
export type { ContentMediaUsageField,ContentMediaUsageFieldDiscovery } from '../../../../seed/upstream/media/usage/content-fields.ts';
type Load=typeof import('../../../../seed/upstream/media/usage/content-fields.ts')['loadContentMediaUsageFields'];
export function loadContentMediaUsageFields(db:Kysely<Database>,...args:Parameters<Load> extends [unknown,...infer A]?A:never) {
  return new NativeMediaUsageContentDependencies(db).fields(...args);
}
