// EmDash 1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
// Whole pinned body; native import paths only.
import type { MediaRepository } from "../database/repositories/media.ts";
import type { Storage } from "../storage/types.ts";

export async function removeUploadAttempt(
	storage: Storage,
	repo: MediaRepository,
	storageKey: string,
	options: { allowUntracked?: boolean } = {},
): Promise<boolean> {
	try {
		if (!(await repo.claimUploadAttemptForCleanup(storageKey))) {
			const tracked = await repo.hasUploadAttempt(storageKey);
			if (tracked || !options.allowUntracked) return false;
		}
	} catch (error) {
		console.error("[media] upload cleanup claim failed:", error);
		return false;
	}

	try {
		await storage.delete(storageKey);
	} catch (error) {
		console.error("[media] upload cleanup failed:", error);
		try {
			await repo.deferUploadAttemptCleanup(storageKey);
		} catch (deferError) {
			console.error("[media] upload cleanup deferral failed:", deferError);
		}
		return false;
	}

	try {
		await repo.deleteUploadAttempt(storageKey);
	} catch (error) {
		console.error("[media] upload cleanup record deletion failed:", error);
	}
	return true;
}
