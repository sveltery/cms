// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// Complete owned progress and repair functions from pinned Source 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e:packages/core/src/api/handlers/media-usage.ts.
// Whole Source authority is retained; Media read functions remain with the sole Media owner.
import type { Kysely } from "kysely";
import { MediaUsageRepository } from "../../database/repositories/media-usage.ts";
import type { Database } from "../../database/types.ts";
import { getMediaUsageActivationStatus, MediaUsageActivationVersionMismatchError } from "../../media/usage/activation.ts";
import { repairContentMediaUsageAll, repairContentMediaUsageCollection, type ContentMediaUsageRepairAllResult, type ContentMediaUsageRepairCollectionResult } from "../../media/usage/content-repair.ts";
import { runMediaUsageMaintenanceStep, type MediaUsageMaintenanceContinuation } from "../../media/usage/maintenance-engine.ts";
import { ErrorCode } from "../errors.ts";
import type { MediaUsageProgress, MediaUsageProgressAdvanceResponse, MediaUsageRepairRequest, MediaUsageRepairResponse } from "../schemas/media-usage.ts";
import type { ApiResult } from "../types.ts";
type ContentMediaUsageRepairResult = ContentMediaUsageRepairCollectionResult | ContentMediaUsageRepairAllResult;

export async function handleMediaUsageProgress(
	db: Kysely<Database>,
): Promise<ApiResult<MediaUsageProgress>> {
	try {
		const progress = await new MediaUsageRepository(db).findCollectionProgress();
		if (!progress) {
			return {
				success: false,
				error: {
					code: ErrorCode.MEDIA_USAGE_PROGRESS_NOT_ACTIVE,
					message: "Media Usage is not active",
				},
			};
		}
		return { success: true, data: progress };
	} catch (error) {
		if (error instanceof MediaUsageActivationVersionMismatchError) {
			return {
				success: false,
				error: {
					code: ErrorCode.MEDIA_USAGE_ACTIVATION_VERSION_MISMATCH,
					message: "Media Usage activation version does not match this runtime",
				},
			};
		}
		console.error("[media-usage] progress read failed:", error);
		return {
			success: false,
			error: {
				code: ErrorCode.MEDIA_USAGE_PROGRESS_READ_ERROR,
				message: "Failed to read media usage progress",
			},
		};
	}
}

export async function handleMediaUsageProgressAdvance(
	db: Kysely<Database>,
): Promise<ApiResult<MediaUsageProgressAdvanceResponse>> {
	try {
		const step = await runMediaUsageMaintenanceStep(db);
		const activation = await getMediaUsageActivationStatus(db);
		if (activation.state === "expanded") {
			return {
				success: false,
				error: {
					code: ErrorCode.MEDIA_USAGE_PROGRESS_NOT_ACTIVE,
					message: "Media Usage activation has not started",
				},
			};
		}

		const progress =
			activation.state === "active"
				? await new MediaUsageRepository(db).findCollectionProgress()
				: null;
		return {
			success: true,
			data: {
				activation,
				progress,
				nextRequestInMs: continuationDelayMs(step.continuation, progress),
			},
		};
	} catch (error) {
		if (error instanceof MediaUsageActivationVersionMismatchError) {
			return {
				success: false,
				error: {
					code: ErrorCode.MEDIA_USAGE_ACTIVATION_VERSION_MISMATCH,
					message: "Media Usage activation version does not match this runtime",
				},
			};
		}
		console.error("[media-usage] progress advance failed:", error);
		return {
			success: false,
			error: {
				code: ErrorCode.MEDIA_USAGE_PROGRESS_ADVANCE_ERROR,
				message: "Failed to advance media usage progress",
			},
		};
	}
}

function continuationDelayMs(
	continuation: MediaUsageMaintenanceContinuation,
	progress: MediaUsageProgress | null,
): 0 | 30_000 | null {
	if (progress?.status === "needs_attention") return null;
	if (continuation.kind === "immediate") return 0;
	if (continuation.kind === "delayed") return 30_000;
	if (progress?.status === "indexing") return 0;
	return null;
}

export async function handleMediaUsageRepair(
	db: Kysely<Database>,
	input: MediaUsageRepairRequest,
): Promise<ApiResult<MediaUsageRepairResponse>> {
	try {
		let result: ContentMediaUsageRepairResult;
		if (input.scope === "collection") {
			result = await repairContentMediaUsageCollection(db, { collectionSlug: input.collection });
		} else if (input.scope === "all") {
			result = await repairContentMediaUsageAll(db);
		} else {
			return {
				success: false,
				error: {
					code: ErrorCode.VALIDATION_ERROR,
					message: "Invalid media usage repair request",
				},
			};
		}

		return { success: true, data: toMediaUsageRepairResponse(result) };
	} catch (error) {
		console.error("[media-usage] repair failed:", error);
		return {
			success: false,
			error: {
				code: ErrorCode.MEDIA_USAGE_REPAIR_ERROR,
				message: "Failed to repair media usage",
			},
		};
	}
}

export function toMediaUsageRepairResponse(
	result: ContentMediaUsageRepairResult,
): MediaUsageRepairResponse {
	const collections = "collections" in result ? result.collections : [result];

	return {
		status: result.status,
		indexedSourceCount: result.indexedSourceCount,
		failedSourceCount: result.failedSourceCount,
		skippedSourceCount: result.skippedSourceCount,
		deletedSourceCount: result.deletedSourceCount,
		collections: collections.map(toMediaUsageRepairCollectionSummary),
	};
}

function toMediaUsageRepairCollectionSummary(result: ContentMediaUsageRepairCollectionResult) {
	return {
		collection: result.scope.scopeKey,
		status: result.status,
		indexedSourceCount: result.indexedSourceCount,
		failedSourceCount: result.failedSourceCount,
		skippedSourceCount: result.skippedSourceCount,
		deletedSourceCount: result.deletedSourceCount,
		lastErrorCode: result.lastErrorCode,
		startedAt: result.startedAt,
		completedAt: result.completedAt,
	};
}

