// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// Source 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e:packages/core/src/api/media-usage-write-fence.ts; complete import-adapted body.
import type { Kysely } from "kysely";

import { tableExists } from "../database/dialect-helpers.ts";
import type { Database } from "../database/types.ts";

export interface MediaUsageActivationWriteFenceError {
	code: "MEDIA_USAGE_ACTIVATION_IN_PROGRESS" | "MEDIA_USAGE_ACTIVATION_CHECK_FAILED";
	message: string;
	status: 503;
}

/**
 * The media usage activation fence alone. Write paths use the unified site
 * write fence in `transfer/fence.ts`, which falls back to this before the
 * transfer tables exist.
 */
export async function findMediaUsageActivationWriteFenceError(
	db: Kysely<Database>,
): Promise<MediaUsageActivationWriteFenceError | null> {
	if (!(await tableExists(db, "_emdash_media_usage_activation"))) return null;
	try {
		const row = await db
			.selectFrom("_emdash_media_usage_activation")
			.select("state")
			.where("task_key", "=", "incremental_capture")
			.executeTakeFirst();
		if (row?.state === "activating") {
			return {
				code: "MEDIA_USAGE_ACTIVATION_IN_PROGRESS",
				message: "Media usage activation is in progress",
				status: 503,
			};
		}
	} catch (error) {
		console.error("[media-usage] Failed to check the activation write fence:", error);
		return {
			code: "MEDIA_USAGE_ACTIVATION_CHECK_FAILED",
			message: "Unable to verify media usage activation state",
			status: 503,
		};
	}
	return null;
}
