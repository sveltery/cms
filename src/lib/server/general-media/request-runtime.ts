import type { CmsDatabase } from '../database/contract.ts';
import type { Storage } from './upstream/storage/types.ts';
import type { MediaRuntime } from './upstream/api/context.ts';
import { generalMediaDatabase } from './storage.ts';
import { handleMediaCreate, handleMediaDelete, handleMediaGet, handleMediaList, handleMediaUpdate } from './upstream/api/handlers/media.ts';
import { invalidateSiteSettingsCache } from './cache.ts';
/** Bind complete pinned handlers to the final trusted request owner. */
export function createMediaRequestRuntime(database:CmsDatabase,storage?:Storage):MediaRuntime {
  const db=generalMediaDatabase(database);
  return {
    db,storage,config:{},
    handleMediaList:options=>handleMediaList(db,options),
    handleMediaGet:id=>handleMediaGet(db,id),
    handleMediaCreate:input=>handleMediaCreate(db,input),
    handleMediaUpdate:(id,input)=>handleMediaUpdate(db,id,input),
    handleMediaDelete:async id=>{
      const result=await handleMediaDelete(db,id,storage);
      if(result.success)invalidateSiteSettingsCache();
      return result;
    }
  };
}
