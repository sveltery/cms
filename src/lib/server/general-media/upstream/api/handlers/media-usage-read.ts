// Seven complete pinned function bodies; partial handler module, zero full-module credit.
// EmDash 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; MIT notices/emdash-MIT.txt.
import type { Kysely } from 'kysely';
import { MediaUsageRepository, type MediaUsageCollectionIndexStatusScope, type MediaUsageEntryGroup } from '../../database/repositories/media-usage.ts';
import { MediaRepository } from '../../database/repositories/media.ts';
import { InvalidCursorError } from '../../../../blocks/upstream/database/repositories/types.ts';
import type { Database } from '../../database/types.ts';
import { CONTENT_MEDIA_USAGE_ADAPTER_ID, CONTENT_MEDIA_USAGE_COLLECTION_SCOPE } from '../../../../blocks/upstream/media/usage/schema-invalidation.ts';
import { CONTENT_SOURCE_SCHEMA_VERSION } from '../../../../blocks/upstream/media/usage/types.ts';
import { groupSiteSettingMediaUsage, MEDIA_USAGE_SITE_SETTING_OPTIONS, type MediaUsageSiteSetting } from '../../media/usage/site-settings.ts';
import { ErrorCode } from '../errors.ts';
import type { MediaUsageCoverage, MediaUsageCoverageStatus, MediaUsageDetailsResponse, MediaUsageEntryDetail, MediaUsageOccurrenceDetail, MediaUsageSiteSettingDetail, MediaUsageSummary } from '../schemas/media-usage.ts';
import type { ApiResult } from '../types.ts';
export function aggregateMediaUsageCoverageStatus(
	scopes: readonly MediaUsageCollectionIndexStatusScope[],
): MediaUsageCoverageStatus {
	const statuses = scopes.map(normalizeMediaUsageCoverageStatus);
	if (statuses.every((status) => status === "complete")) {
		return "complete";
	}
	if (statuses.includes("unknown")) return "unknown";
	if (statuses.includes("running")) return "running";
	if (statuses.includes("stale")) return "stale";
	if (statuses.includes("partial")) return "partial";
	if (statuses.every((status) => status === "never")) return "never";
	if (statuses.every((status) => status === "failed")) return "failed";
	return "partial";
}

export async function handleMediaUsageSummaries(
	db: Kysely<Database>,
	mediaIds: readonly string[],
	options: { includeCount: boolean },
): Promise<ApiResult<Record<string, MediaUsageSummary>>> {
	if (mediaIds.length === 0) return { success: true, data: {} };

	try {
		const repository = new MediaUsageRepository(db);
		const { coverage, siteSettings } = await loadMediaUsageCoverage(repository);
		const counts =
			options.includeCount && coverage.status === "complete"
				? await repository.findActiveEntryCountsByMediaIds(mediaIds)
				: null;
		const summaries: Record<string, MediaUsageSummary> = {};

		for (const mediaId of new Set(mediaIds)) {
			summaries[mediaId] = {
				count: counts
					? (counts.get(mediaId) ?? 0) + (siteSettings.get(mediaId)?.length ?? 0)
					: null,
				coverage,
			};
		}

		return { success: true, data: summaries };
	} catch (error) {
		console.error("[media-usage] summary read failed:", error);
		return {
			success: false,
			error: {
				code: ErrorCode.MEDIA_USAGE_READ_ERROR,
				message: "Failed to read media usage",
			},
		};
	}
}

export async function handleMediaUsageDetails(
	db: Kysely<Database>,
	mediaId: string,
	options: { cursor?: string; limit?: number },
): Promise<ApiResult<MediaUsageDetailsResponse>> {
	try {
		const media = await new MediaRepository(db).findById(mediaId);
		if (!media) {
			return {
				success: false,
				error: {
					code: ErrorCode.NOT_FOUND,
					message: `Media item not found: ${mediaId}`,
				},
			};
		}

		const repository = new MediaUsageRepository(db);
		const { coverage, siteSettings } = await loadMediaUsageCoverage(repository);
		const page = await repository.findCurrentEntryUsagePageByMediaId(mediaId, options);
		return {
			success: true,
			data: {
				items: page.items.map(toMediaUsageEntryDetail),
				...(page.nextCursor ? { nextCursor: page.nextCursor } : {}),
				siteSettings: (siteSettings.get(mediaId) ?? []).map(
					(setting): MediaUsageSiteSettingDetail => ({ setting }),
				),
				coverage,
			},
		};
	} catch (error) {
		if (error instanceof InvalidCursorError) {
			return {
				success: false,
				error: { code: ErrorCode.INVALID_CURSOR, message: error.message },
			};
		}
		console.error("[media-usage] detail read failed:", error);
		return {
			success: false,
			error: {
				code: ErrorCode.MEDIA_USAGE_READ_ERROR,
				message: "Failed to read media usage",
			},
		};
	}
}

function normalizeMediaUsageCoverageStatus(
	scope: MediaUsageCollectionIndexStatusScope,
): MediaUsageCoverageStatus {
	if (scope.status === null) return "never";
	if (scope.status === "complete") {
		if (scope.reconciliationRequired) return "stale";
		return scope.schemaVersion === CONTENT_SOURCE_SCHEMA_VERSION ? "complete" : "stale";
	}
	if (
		scope.status === "never" ||
		scope.status === "running" ||
		scope.status === "partial" ||
		scope.status === "failed" ||
		scope.status === "stale"
	) {
		return scope.status;
	}
	return "unknown";
}

async function loadMediaUsageCoverage(repository: MediaUsageRepository): Promise<{
	coverage: MediaUsageCoverage;
	siteSettings: Map<string, MediaUsageSiteSetting[]>;
}> {
	const { scopes, options } = await repository.findCoverageWithOptions(
		{
			adapterId: CONTENT_MEDIA_USAGE_ADAPTER_ID,
			scopeType: CONTENT_MEDIA_USAGE_COLLECTION_SCOPE,
		},
		MEDIA_USAGE_SITE_SETTING_OPTIONS,
	);
	return {
		coverage: {
			scope: "all_content_collections",
			status: aggregateMediaUsageCoverageStatus(scopes),
		},
		siteSettings: groupSiteSettingMediaUsage(options),
	};
}

function toMediaUsageEntryDetail(group: MediaUsageEntryGroup): MediaUsageEntryDetail {
	const preferred =
		group.sources.find(({ source }) => source.sourceVariant === "draft_overlay") ??
		group.sources.find(({ source }) => source.sourceVariant === "columns");
	if (!preferred) {
		throw new Error("Media usage entry has no supported source");
	}

	return {
		collection: group.collectionSlug,
		contentId: group.contentId,
		title: preferred.source.contentTitle,
		slug: preferred.source.contentSlug,
		locale: preferred.source.locale,
		status: preferred.source.contentStatus,
		scheduledAt: preferred.source.contentScheduledAt,
		deletedAt: group.contentDeletedAt,
		sources: group.sources.flatMap(({ source, occurrences }) => {
			if (source.sourceVariant !== "columns" && source.sourceVariant !== "draft_overlay") {
				return [];
			}
			return [
				{
					variant: source.sourceVariant,
					occurrences: occurrences.map((occurrence) => ({
						fieldSlug: occurrence.fieldSlug,
						fieldPath: occurrence.fieldPath,
						occurrenceIndex: occurrence.occurrenceIndex,
						referenceType: normalizeMediaUsageReferenceType(occurrence.referenceType),
					})),
				},
			];
		}),
	};
}

function normalizeMediaUsageReferenceType(
	referenceType: string,
): MediaUsageOccurrenceDetail["referenceType"] {
	if (
		referenceType === "image_field" ||
		referenceType === "file_field" ||
		referenceType === "portable_text_image"
	) {
		return referenceType;
	}
	return "unknown";
}
