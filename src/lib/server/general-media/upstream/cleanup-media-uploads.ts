// EmDash immutable 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; MIT notices/emdash-MIT.txt.
// Exact complete Source cleanup subsystems3/4 try blocks; partial module, no full runSystemCleanup credit.
import type {Kysely} from 'kysely';
import type {Database} from './database/types.ts';
import type {Storage} from './storage/types.ts';
import {MediaRepository} from './database/repositories/media.ts';
import {removeUploadAttempt} from './media/upload-attempts.ts';
export interface MediaUploadCleanupResult {pendingUploads:number;pendingUploadFiles:number;uploadAttempts:number}
export async function runMediaUploadCleanup(db:Kysely<Database>,storage?:Storage):Promise<MediaUploadCleanupResult>{
 const result:MediaUploadCleanupResult={pendingUploads:-1,pendingUploadFiles:-1,uploadAttempts:-1};
try {
		const mediaRepo = new MediaRepository(db);
		const orphanedKeys = await mediaRepo.cleanupPendingUploads();
		result.pendingUploads = orphanedKeys.length;

		// Delete orphaned files from object storage
		if (storage && orphanedKeys.length > 0) {
			let filesDeleted = 0;
			for (const key of orphanedKeys) {
				try {
					await storage.delete(key);
					filesDeleted++;
				} catch (error) {
					// Log per-file failures but continue -- storage.delete is
					// documented as idempotent, so this is an unexpected error.
					console.error(`[cleanup] Failed to delete storage file ${key}:`, error);
				}
			}
			result.pendingUploadFiles = filesDeleted;
		} else {
			result.pendingUploadFiles = 0;
		}
	} catch (error) {
		console.error("[cleanup] Failed to clean pending uploads:", error);
	}

try {
		const mediaRepo = new MediaRepository(db);
		const completedAttemptsDeleted = await mediaRepo.deleteCompletedUploadAttempts();
		if (!storage) {
			result.uploadAttempts = completedAttemptsDeleted;
		} else {
			const storageKeys = await mediaRepo.findUploadAttemptsForCleanup();
			let attemptsDeleted = completedAttemptsDeleted;
			for (const storageKey of storageKeys) {
				if (await removeUploadAttempt(storage, mediaRepo, storageKey)) {
					attemptsDeleted++;
				}
			}
			result.uploadAttempts = attemptsDeleted;
		}
	} catch (error) {
		console.error("[cleanup] Failed to clean media upload attempts:", error);
	}
 return result;
}
