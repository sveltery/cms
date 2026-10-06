import type {CmsDatabase} from '../database/contract.ts';
import type {Storage} from './upstream/storage/types.ts';
import {generalMediaDatabase} from './storage.ts';
import {runMediaUploadCleanup} from './upstream/cleanup-media-uploads.ts';
export type {MediaUploadCleanupResult} from './upstream/cleanup-media-uploads.ts';
/** Trusted operator on existing canonical storage; installs no schema or cron. */
export function cleanupMediaUploads(database:CmsDatabase,storage?:Storage){return runMediaUploadCleanup(generalMediaDatabase(database),storage);}
