// Native logical names for the dashboard's bounded Source SQL; type-only, not schema evidence.
import type { Database as NativeLifecycleDatabase }
  from '../../database/lifecycle/upstream/database/types.ts';
import type { Database as CanonicalDatabase } from '../../canonical-storage/types.ts';
export interface Database extends NativeLifecycleDatabase, CanonicalDatabase {
  _emdash_collections: NativeLifecycleDatabase['_cms_collections'];
  _emdash_fields: NativeLifecycleDatabase['_cms_fields'];
}
