import type { CmsDatabase } from '../database/contract.ts';
import { generalMediaDatabase } from './storage.ts';
import { MediaRepository as PinnedMediaRepository } from './upstream/database/repositories/media.ts';
import { MediaFolderRepository as PinnedMediaFolderRepository } from './upstream/database/repositories/media-folders.ts';
import { handleMediaDelete, handleMediaGet, handleMediaList, handleMediaUpdate } from './upstream/api/handlers/media.ts';
import { handleMediaUpload, type MediaUploadInput, type MediaUploadHooks } from './upstream/api/handlers/media-upload.ts';
import type { FindManyMediaOptions } from './upstream/database/repositories/media.ts';
import type { Storage } from './upstream/storage/types.ts';
import { invalidateSiteSettingsCache } from './cache.ts';
import {cleanupMediaUploads} from './cleanup.ts';
export {cleanupMediaUploads} from './cleanup.ts';
export { LocalStorage } from './upstream/storage/local.ts';
export type * from './upstream/storage/types.ts';
export type * from './upstream/database/repositories/media.ts';
export type * from './upstream/database/repositories/media-folders.ts';
export class MediaRepository extends PinnedMediaRepository {
  constructor(database:CmsDatabase){super(generalMediaDatabase(database));}
}
export class MediaFolderRepository extends PinnedMediaFolderRepository {
  constructor(database:CmsDatabase){super(generalMediaDatabase(database));}
}
/** Trusted backend; HTTP/session authorization remains with native request composition. */
export function createGeneralMediaBackend(database:CmsDatabase,storage:Storage) {
  const db=generalMediaDatabase(database);
  return {
    repository:new PinnedMediaRepository(db),folders:new PinnedMediaFolderRepository(db),
    list:(options:FindManyMediaOptions={})=>handleMediaList(db,options),
    get:(id:string)=>handleMediaGet(db,id),
    cleanup:()=>cleanupMediaUploads(database,storage),
    update:(id:string,input:Parameters<typeof handleMediaUpdate>[2])=>handleMediaUpdate(db,id,input),
    upload:(input:MediaUploadInput,hooks:MediaUploadHooks={})=>handleMediaUpload(db,storage,input,hooks),
    delete:async(id:string)=>{
      const result=await handleMediaDelete(db,id,storage);
      if(result.success)invalidateSiteSettingsCache();
      return result;
    }
  };
}
