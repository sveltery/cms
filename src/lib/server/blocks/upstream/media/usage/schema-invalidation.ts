// EmDash 1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; whole Source packages/core/src/media/usage/schema-invalidation.ts.
// Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
// Host adaptations are explicitly inventoried in the block registry proposal.
import type { Kysely } from "kysely";

import { tableExists } from "../../database/dialect-helpers.ts";
import { MediaUsageRepository } from "../../database/repositories/media-usage.ts";
import type { Database } from "../../database/types.ts";
import { validateIdentifier } from "../../database/validate.ts";
import { CONTENT_SOURCE_SCHEMA_VERSION } from "./types.ts";

export const CONTENT_MEDIA_USAGE_ADAPTER_ID = "content-media";
export const CONTENT_MEDIA_USAGE_COLLECTION_SCOPE = "collection";

export async function markContentMediaUsageCollectionStale(
	db: Kysely<Database>,
	collectionSlug: string,
	lastErrorCode: string,
): Promise<void> {
	validateIdentifier(collectionSlug, "collection slug");
	const repo = new MediaUsageRepository(db);
	const identity = {
		adapterId: CONTENT_MEDIA_USAGE_ADAPTER_ID,
		scopeType: CONTENT_MEDIA_USAGE_COLLECTION_SCOPE,
		scopeKey: collectionSlug,
	};
	const existing = await repo.findIndexStatus(identity);
	await repo.upsertIndexStatus({
		...identity,
		status: "stale",
		schemaVersion: existing?.schemaVersion ?? CONTENT_SOURCE_SCHEMA_VERSION,
		startedAt: existing?.startedAt ?? null,
		completedAt: existing?.completedAt ?? null,
		cursor: existing?.cursor ?? null,
		indexedSourceCount: existing?.indexedSourceCount ?? 0,
		failedSourceCount: existing?.failedSourceCount ?? 0,
		lastErrorCode,
	});
}

export async function invalidateContentMediaUsageSchemaChange(
	db: Kysely<Database>,
	collectionSlug: string,
): Promise<boolean> {
	validateIdentifier(collectionSlug, "collection slug");
	if (!(await tableExists(db, "_cms_media_usage_activation"))) return false;
	const activation = await db
		.selectFrom("_cms_media_usage_activation")
		.select("state")
		.where("task_key", "=", "incremental_capture")
		.executeTakeFirst();
	if (activation?.state !== "active") return false;

	const invalidated = await new MediaUsageRepository(db).invalidateIndexStatusForSchemaChange(
		collectionSlug,
	);
	if (!invalidated) {
		throw new Error(`Cannot invalidate media usage coverage for collection ${collectionSlug}`);
	}
	return true;
}

export async function markContentMediaUsageCollectionStaleSafely(
	db: Kysely<Database>,
	collectionSlug: string,
	lastErrorCode: string,
): Promise<boolean> {
	try {
		await markContentMediaUsageCollectionStale(db, collectionSlug, lastErrorCode);
		return true;
	} catch (error) {
		console.error(`[media-usage] Failed to mark ${collectionSlug} stale:`, error);
		return false;
	}
}
