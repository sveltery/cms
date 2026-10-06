// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// Complete pinned Source runtime successful-write and permanent-delete usage methods.
// Only the class receiver becomes the existing trusted database parameter.
import type { Kysely } from "kysely";
import type { Database } from "./database/types.ts";
import { processMediaUsageWorkAfterWrite } from "./media/usage/work-processor.ts";
import { refreshContentMediaUsageAfterWrite,deleteContentMediaUsage } from "./media/usage/content-refresh.ts";

export async function refreshContentUsageAfterSuccessfulWrite(
	db: Kysely<Database>,
		collection: string,
		contentIds: readonly string[],
	): Promise<void> {
		for (const contentId of new Set(contentIds)) {
			try {
				const work = await processMediaUsageWorkAfterWrite(db, collection, contentId);
				if (work.outcome !== "inactive") continue;
				await refreshContentMediaUsageAfterWrite(db, collection, contentId);
			} catch (error) {
				console.error(
					`[media-usage] Failed after content write ${collection}/${contentId}:`,
					error,
				);
				continue;
			}
		}
	}

export async function deleteContentUsageAfterSuccessfulPermanentDelete(
	db: Kysely<Database>,
		collection: string,
		contentId: string,
	): Promise<void> {
		try {
			const work = await processMediaUsageWorkAfterWrite(db, collection, contentId);
			if (work.outcome !== "inactive") return;
			const result = await deleteContentMediaUsage(db, collection, contentId);
			if (!result.success) {
				console.error(
					`[media-usage] Usage delete for ${collection}/${contentId} finished with ${result.errorCode}`,
				);
			}
		} catch (error) {
			console.error(
				`[media-usage] Failed after permanent content delete ${collection}/${contentId}:`,
				error,
			);
		}
	}

