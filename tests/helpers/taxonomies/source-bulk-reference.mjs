// TEST-ONLY genuine Source read hosts use the exact supplied handle, including
// its counting plugin. The bulk taxonomy implementation remains Native.
import {SchemaRegistry} from '../../../parity/emdash/taxonomies/source/packages/core/src/schema/registry.ts';
import {ContentRepository} from '../../../parity/emdash/taxonomies/source/packages/core/src/database/repositories/content.ts';
import {handleBulkTag as nativeBulkTag} from '../../../src/lib/server/taxonomies/bulk-tag.ts';
export function handleBulkTag(db,origin,input,invalidate){
 return nativeBulkTag(db,origin,input,invalidate,{registry:new SchemaRegistry(db),content:new ContentRepository(db)});
}
