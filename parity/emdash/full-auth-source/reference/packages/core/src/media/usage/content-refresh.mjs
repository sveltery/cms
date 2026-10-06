import { sql } from "kysely";
import { MediaUsageRepository, } from "../../database/repositories/media-usage.js";
import { validateIdentifier } from "../../database/validate.js";
import { isI18nEnabled } from "../../i18n/config.js";
import { loadContentMediaUsageFields, } from "./content-fields.js";
import { loadContentMediaUsageSnapshots, loadContentMediaUsageSnapshotsBatch, } from "./content-snapshots.js";
import { CONTENT_MEDIA_USAGE_ADAPTER_ID, CONTENT_MEDIA_USAGE_COLLECTION_SCOPE, markContentMediaUsageCollectionStale, markContentMediaUsageCollectionStaleSafely, } from "./schema-invalidation.js";
import { buildContentMediaUsageSourceKey, MEDIA_USAGE_CONTENT_SOURCE_VARIANTS, } from "./source-key.js";
export { CONTENT_MEDIA_USAGE_ADAPTER_ID, CONTENT_MEDIA_USAGE_COLLECTION_SCOPE, invalidateContentMediaUsageSchemaChange, markContentMediaUsageCollectionStale, markContentMediaUsageCollectionStaleSafely, } from "./schema-invalidation.js";
const CONTENT_USAGE_LOCKS_KEY = Symbol.for("emdash.mediaUsage.contentLocks");
const CONTENT_USAGE_COLLECTION_LOCKS_KEY = Symbol.for("emdash.mediaUsage.collectionLocks");
const CONTENT_USAGE_REFRESH_MAX_ATTEMPTS = 2;
export const MEDIA_USAGE_PROJECTION_ADMISSION_LIMITS = Object.freeze({
    maxOccurrenceMutationUnitsPerClaim: 500,
    maxProjectionMutationBytesPerVariant: 2_000_000,
    maxProjectionMutationBytesPerClaim: 4_000_000,
    maxOccurrenceMutationUnitsPerBatch: 50_000,
    maxProjectionMutationBytesPerBatch: 16_000_000,
});
const ZERO_RESULT = {
    success: true,
    refreshedSourceCount: 0,
    deletedSourceCount: 0,
    failedSourceCount: 0,
};
export function createContentMediaUsageAdmissionBudget(limits = {}) {
    return {
        remainingOccurrenceMutationUnits: limits.maxOccurrenceMutationUnits ??
            MEDIA_USAGE_PROJECTION_ADMISSION_LIMITS.maxOccurrenceMutationUnitsPerClaim,
        remainingProjectionMutationBytes: limits.maxProjectionMutationBytes ??
            MEDIA_USAGE_PROJECTION_ADMISSION_LIMITS.maxProjectionMutationBytesPerClaim,
        hasReservedMutation: false,
    };
}
export async function planContentMediaUsageProjectionAdmission(repo, snapshots, observedSources, canonicalSourceKeys, budget) {
    const snapshotSourceKeys = new Set(snapshots.map((snapshot) => snapshot.source.sourceKey));
    const absentSources = canonicalSourceKeys
        .filter((sourceKey) => !snapshotSourceKeys.has(sourceKey))
        .map((sourceKey) => observedSources.get(sourceKey))
        .filter((source) => source !== undefined);
    let deletionOccurrenceUnits = 0;
    let deletionBytes = 0;
    let largestDeletionBytes = 0;
    for (const source of absentSources) {
        const measurement = await repo.measureSourceGenerationDeletion(source.sourceKey, source.currentGeneration, MEDIA_USAGE_PROJECTION_ADMISSION_LIMITS.maxOccurrenceMutationUnitsPerClaim);
        if (measurement.exceedsOccurrenceLimit) {
            return budget.hasReservedMutation
                ? { outcome: "claim_budget_deferred" }
                : { outcome: "intrinsic_resource_limit" };
        }
        deletionOccurrenceUnits += measurement.occurrenceCount;
        const sourceDeletionBytes = storedMediaUsageSourceByteLength(source) + measurement.occurrenceBytes * 2;
        deletionBytes += sourceDeletionBytes;
        largestDeletionBytes = Math.max(largestDeletionBytes, sourceDeletionBytes);
    }
    const noOpSourceKeys = new Set();
    let cost = projectionAdmissionCost(snapshots, noOpSourceKeys, deletionOccurrenceUnits, deletionBytes, largestDeletionBytes);
    if (exceedsProjectionAdmissionLimits(cost)) {
        for (const snapshot of snapshots) {
            const expectedSource = observedSources.get(snapshot.source.sourceKey);
            if (expectedSource &&
                (await repo.projectionMatchesExpectedSource(snapshot.source, expectedSource))) {
                noOpSourceKeys.add(snapshot.source.sourceKey);
            }
        }
        cost = projectionAdmissionCost(snapshots, noOpSourceKeys, deletionOccurrenceUnits, deletionBytes, largestDeletionBytes);
    }
    if (exceedsProjectionAdmissionLimits(cost)) {
        return budget.hasReservedMutation
            ? { outcome: "claim_budget_deferred" }
            : { outcome: "intrinsic_resource_limit" };
    }
    if (cost.occurrenceMutationUnits > budget.remainingOccurrenceMutationUnits ||
        cost.projectionMutationBytes > budget.remainingProjectionMutationBytes) {
        return { outcome: "claim_budget_deferred" };
    }
    budget.remainingOccurrenceMutationUnits -= cost.occurrenceMutationUnits;
    budget.remainingProjectionMutationBytes -= cost.projectionMutationBytes;
    if (cost.occurrenceMutationUnits > 0 || cost.projectionMutationBytes > 0) {
        budget.hasReservedMutation = true;
    }
    return {
        outcome: "admitted",
        noOpSourceKeys,
        absentSources,
        ...cost,
    };
}
function projectionAdmissionCost(snapshots, noOpSourceKeys, deletionOccurrenceUnits, deletionBytes, largestDeletionBytes) {
    return snapshots.reduce((cost, snapshot) => {
        if (noOpSourceKeys.has(snapshot.source.sourceKey))
            return cost;
        cost.occurrenceMutationUnits += snapshot.occurrences.length;
        cost.projectionMutationBytes += snapshot.projectionByteLength;
        cost.largestProjectionMutationBytes = Math.max(cost.largestProjectionMutationBytes, snapshot.projectionByteLength);
        return cost;
    }, {
        occurrenceMutationUnits: deletionOccurrenceUnits,
        projectionMutationBytes: deletionBytes,
        largestProjectionMutationBytes: largestDeletionBytes,
    });
}
function exceedsProjectionAdmissionLimits(cost) {
    return (cost.occurrenceMutationUnits >
        MEDIA_USAGE_PROJECTION_ADMISSION_LIMITS.maxOccurrenceMutationUnitsPerClaim ||
        cost.largestProjectionMutationBytes >
            MEDIA_USAGE_PROJECTION_ADMISSION_LIMITS.maxProjectionMutationBytesPerVariant ||
        cost.projectionMutationBytes >
            MEDIA_USAGE_PROJECTION_ADMISSION_LIMITS.maxProjectionMutationBytesPerClaim);
}
function storedMediaUsageSourceByteLength(source) {
    return new TextEncoder().encode(JSON.stringify(source)).byteLength;
}
export async function refreshContentMediaUsage(db, collectionSlug, contentId) {
    validateIdentifier(collectionSlug, "collection slug");
    return withContentUsageCollectionLock(collectionSlug, () => withContentUsageLock(collectionSlug, contentId, () => refreshContentMediaUsageUnlocked(db, collectionSlug, contentId, {})));
}
export async function refreshContentMediaUsageForWorkBatch(db, items, options = {}) {
    const results = new Map();
    const batchBudget = createContentMediaUsageAdmissionBudget({
        maxOccurrenceMutationUnits: MEDIA_USAGE_PROJECTION_ADMISSION_LIMITS.maxOccurrenceMutationUnitsPerBatch,
        maxProjectionMutationBytes: MEDIA_USAGE_PROJECTION_ADMISSION_LIMITS.maxProjectionMutationBytesPerBatch,
    });
    const collections = new Map();
    for (const item of items) {
        const key = `${item.collectionId}\u0000${item.collectionSlug}`;
        const collectionItems = collections.get(key) ?? [];
        collectionItems.push(item);
        collections.set(key, collectionItems);
    }
    for (const collectionItems of collections.values()) {
        if (options.shouldContinue && !options.shouldContinue())
            break;
        const first = collectionItems[0];
        if (!first)
            continue;
        validateIdentifier(first.collectionSlug, "collection slug");
        if (!first.collectionId)
            throw new Error("Durable media usage work requires a collection identity");
        await withContentUsageCollectionLock(first.collectionSlug, async () => {
            const fieldDiscovery = await loadContentMediaUsageFields(db, first.collectionSlug, first.collectionId);
            const sourceKeys = collectionItems.flatMap((item) => contentSourceKeys(item.collectionSlug, item.contentId, item.collectionId));
            const repo = new MediaUsageRepository(db);
            const observedSources = await repo.findSources(sourceKeys);
            const snapshots = await loadContentMediaUsageSnapshotsBatch(db, first.collectionSlug, collectionItems.map((item) => item.contentId), fieldDiscovery, { collectionId: first.collectionId, identityVersion: 1 }, {
                shouldContinue: options.shouldContinue,
                maxOccurrenceCount: MEDIA_USAGE_PROJECTION_ADMISSION_LIMITS.maxOccurrenceMutationUnitsPerBatch,
                maxProjectionBytes: MEDIA_USAGE_PROJECTION_ADMISSION_LIMITS.maxProjectionMutationBytesPerBatch,
            });
            const newSourceProjections = [];
            const newSourceKeys = new Map();
            const existingSourceProjections = [];
            const unchangedSourceProjections = [];
            const existingSourceKeys = new Map();
            for (const item of collectionItems) {
                if (options.shouldContinue && !options.shouldContinue())
                    break;
                const snapshotsResult = snapshots.get(item.contentId);
                const itemSourceKeys = contentSourceKeys(item.collectionSlug, item.contentId, item.collectionId);
                if (!snapshotsResult?.success) {
                    continue;
                }
                const snapshotsByKey = new Map(snapshotsResult.snapshots.map((snapshot) => [snapshot.source.sourceKey, snapshot]));
                const existing = itemSourceKeys
                    .map((sourceKey) => observedSources.get(sourceKey))
                    .filter((source) => source !== undefined);
                const allNew = existing.length === 0;
                const allExisting = existing.length === snapshotsResult.snapshots.length &&
                    existing.every((source) => snapshotsByKey.has(source.sourceKey));
                if (!allNew && !allExisting)
                    continue;
                const admission = await planContentMediaUsageProjectionAdmission(repo, snapshotsResult.snapshots, observedSources, itemSourceKeys, batchBudget);
                if (admission.outcome === "claim_budget_deferred")
                    break;
                if (admission.outcome !== "admitted") {
                    results.set(contentRefreshKey(item.collectionId, item.contentId), admissionFailureResult(admission.outcome));
                    continue;
                }
                const key = contentRefreshKey(item.collectionId, item.contentId);
                if (allNew) {
                    newSourceProjections.push(...snapshotsResult.snapshots.map((snapshot) => ({
                        source: snapshot.source,
                        occurrences: snapshot.occurrences,
                    })));
                    newSourceKeys.set(key, snapshotsResult.snapshots.map((snapshot) => snapshot.source.sourceKey));
                    continue;
                }
                const changed = [];
                const unchanged = [];
                for (const snapshot of snapshotsResult.snapshots) {
                    const expectedSource = observedSources.get(snapshot.source.sourceKey);
                    if (!expectedSource)
                        continue;
                    if (expectedSource.sourceFingerprint === snapshot.source.sourceFingerprint &&
                        expectedSource.sourceCompleteness ===
                            (snapshot.source.sourceCompleteness ?? "complete") &&
                        expectedSource.lastErrorCode === null) {
                        unchanged.push(snapshot.source.sourceKey);
                        unchangedSourceProjections.push({
                            source: snapshot.source,
                            occurrences: snapshot.occurrences,
                            expectedSource,
                        });
                        continue;
                    }
                    changed.push(snapshot.source.sourceKey);
                    existingSourceProjections.push({
                        source: snapshot.source,
                        occurrences: snapshot.occurrences,
                        expectedSource,
                    });
                }
                existingSourceKeys.set(key, {
                    allCount: snapshotsResult.snapshots.length,
                    changed,
                    unchanged,
                });
            }
            const insertedSourceKeys = await repo.replaceNewSourcesBatch(newSourceProjections);
            const replacedSourceKeys = await repo.replaceExistingSourcesBatch(existingSourceProjections);
            const matchedSourceKeys = await repo.matchingExistingSourcesBatch(unchangedSourceProjections);
            for (const [key, expectedSourceKeys] of newSourceKeys) {
                results.set(key, expectedSourceKeys.every((sourceKey) => insertedSourceKeys.has(sourceKey))
                    ? {
                        success: true,
                        refreshedSourceCount: expectedSourceKeys.length,
                        deletedSourceCount: 0,
                        failedSourceCount: 0,
                    }
                    : generationConflictResult({ refreshedSourceCount: 0, deletedSourceCount: 0 }));
            }
            for (const [key, expected] of existingSourceKeys) {
                results.set(key, expected.changed.every((sourceKey) => replacedSourceKeys.has(sourceKey)) &&
                    expected.unchanged.every((sourceKey) => matchedSourceKeys.has(sourceKey))
                    ? {
                        success: true,
                        refreshedSourceCount: expected.allCount,
                        deletedSourceCount: 0,
                        failedSourceCount: 0,
                    }
                    : generationConflictResult({ refreshedSourceCount: 0, deletedSourceCount: 0 }));
            }
            for (const item of collectionItems) {
                if (options.shouldContinue && !options.shouldContinue())
                    break;
                const key = contentRefreshKey(item.collectionId, item.contentId);
                if (!snapshots.has(item.contentId))
                    continue;
                if (results.has(key))
                    continue;
                const result = await withContentUsageLock(item.collectionSlug, item.contentId, () => refreshContentMediaUsageUnlocked(db, item.collectionSlug, item.contentId, {
                    collectionId: item.collectionId,
                    durableWork: true,
                    fieldDiscovery,
                    observedSources,
                    snapshotsResult: snapshots.get(item.contentId),
                }));
                results.set(key, result);
            }
        });
    }
    return results;
}
async function refreshContentMediaUsageUnlocked(db, collectionSlug, contentId, options) {
    try {
        let conflictResult = null;
        if (options.durableWork)
            options.admissionBudget = createContentMediaUsageAdmissionBudget();
        for (let attempt = 0; attempt < CONTENT_USAGE_REFRESH_MAX_ATTEMPTS; attempt++) {
            const result = await refreshContentMediaUsageAttempt(db, collectionSlug, contentId, options);
            if (result.errorCode !== "CONTENT_USAGE_GENERATION_CONFLICT")
                return result;
            conflictResult = result;
            if (options.admissionBudget?.hasReservedMutation)
                break;
        }
        if (options.durableWork) {
            return generationConflictResult({
                refreshedSourceCount: conflictResult?.refreshedSourceCount ?? 0,
                deletedSourceCount: conflictResult?.deletedSourceCount ?? 0,
            });
        }
        return markGenerationConflict(db, collectionSlug, {
            refreshedSourceCount: conflictResult?.refreshedSourceCount ?? 0,
            deletedSourceCount: conflictResult?.deletedSourceCount ?? 0,
        });
    }
    catch (error) {
        console.error(`[media-usage] Failed to refresh ${collectionSlug}/${contentId}:`, error);
        if (!options.durableWork) {
            await markContentMediaUsageCollectionStaleSafely(db, collectionSlug, "CONTENT_USAGE_REFRESH_ERROR");
        }
        return {
            success: false,
            refreshedSourceCount: 0,
            deletedSourceCount: 0,
            failedSourceCount: 0,
            errorCode: "CONTENT_USAGE_REFRESH_ERROR",
        };
    }
}
async function refreshContentMediaUsageAttempt(db, collectionSlug, contentId, options) {
    const repo = new MediaUsageRepository(db);
    const canonicalSourceKeys = contentSourceKeys(collectionSlug, contentId, options.collectionId);
    const observedSources = options.observedSources ?? (await repo.findSources(canonicalSourceKeys));
    const snapshotsResult = options.snapshotsResult ??
        (await loadContentMediaUsageSnapshots(db, collectionSlug, contentId, options.fieldDiscovery, options.collectionId ? { collectionId: options.collectionId, identityVersion: 1 } : undefined));
    if (!snapshotsResult.success) {
        if (snapshotsResult.error === "CONTENT_NOT_FOUND" && options.collectionId) {
            if (!options.admissionBudget)
                throw new Error("Durable media usage work requires an admission budget");
            const admission = await planContentMediaUsageProjectionAdmission(repo, [], observedSources, canonicalSourceKeys, options.admissionBudget);
            if (admission.outcome !== "admitted")
                return admissionFailureResult(admission.outcome);
            return deleteCanonicalContentSourcesIfAbsent(repo, admission.absentSources, collectionSlug, contentId);
        }
        if (snapshotsResult.error === "CONTENT_NOT_FOUND" &&
            !(await contentCollectionExists(db, collectionSlug))) {
            const deletedSourceCount = await repo.deleteContentSources(collectionSlug, contentId);
            return { ...ZERO_RESULT, deletedSourceCount };
        }
        return options.durableWork
            ? snapshotFailureResult(snapshotsResult)
            : markSnapshotFailure(db, collectionSlug, snapshotsResult);
    }
    if (!options.collectionId && !(await contentCollectionExists(db, collectionSlug))) {
        const deletedSourceCount = await repo.deleteContentSources(collectionSlug, contentId);
        return { ...ZERO_RESULT, deletedSourceCount };
    }
    const admission = options.admissionBudget
        ? await planContentMediaUsageProjectionAdmission(repo, snapshotsResult.snapshots, observedSources, canonicalSourceKeys, options.admissionBudget)
        : null;
    if (admission && admission.outcome !== "admitted") {
        return admissionFailureResult(admission.outcome);
    }
    let refreshedSourceCount = 0;
    for (const snapshot of snapshotsResult.snapshots) {
        if (admission?.outcome === "admitted" &&
            admission.noOpSourceKeys.has(snapshot.source.sourceKey)) {
            refreshedSourceCount++;
            continue;
        }
        const result = await repo.replaceSourceIfMatching(snapshot.source, snapshot.occurrences, observedSources.get(snapshot.source.sourceKey) ?? null);
        if (result.unchanged) {
            refreshedSourceCount++;
            continue;
        }
        if (!result.replaced) {
            return generationConflictResult({
                refreshedSourceCount,
                deletedSourceCount: 0,
            });
        }
        refreshedSourceCount++;
    }
    if (!options.collectionId && !(await contentCollectionExists(db, collectionSlug))) {
        const deletedSourceCount = await repo.deleteContentSources(collectionSlug, contentId);
        return { ...ZERO_RESULT, deletedSourceCount };
    }
    const expectedSourceKeys = new Set(snapshotsResult.snapshots.map((snapshot) => snapshot.source.sourceKey));
    const absentSources = admission?.outcome === "admitted"
        ? admission.absentSources
        : canonicalSourceKeys
            .filter((sourceKey) => !expectedSourceKeys.has(sourceKey))
            .map((sourceKey) => observedSources.get(sourceKey))
            .filter((source) => source !== undefined);
    let deletedSourceCount = 0;
    for (const expectedSource of absentSources) {
        const result = await repo.deleteSourceIfMatching(expectedSource.sourceKey, expectedSource);
        if (result.deleted) {
            deletedSourceCount++;
            continue;
        }
        if (result.source) {
            return generationConflictResult({
                refreshedSourceCount,
                deletedSourceCount,
            });
        }
    }
    return {
        success: true,
        refreshedSourceCount,
        deletedSourceCount,
        failedSourceCount: 0,
    };
}
export function contentRefreshKey(collectionId, contentId) {
    return `${collectionId}\u0000${contentId}`;
}
function contentSourceKeys(collectionSlug, contentId, collectionId) {
    return MEDIA_USAGE_CONTENT_SOURCE_VARIANTS.map((sourceVariant) => buildContentMediaUsageSourceKey({
        collectionId,
        collectionSlug,
        contentId,
        sourceVariant,
    }));
}
function admissionFailureResult(outcome) {
    return {
        ...generationConflictResult({ refreshedSourceCount: 0, deletedSourceCount: 0 }),
        errorCode: outcome === "intrinsic_resource_limit"
            ? "CONTENT_USAGE_RESOURCE_LIMIT"
            : "CONTENT_USAGE_GENERATION_CONFLICT",
    };
}
async function markGenerationConflict(db, collectionSlug, counts) {
    await markContentMediaUsageCollectionStaleSafely(db, collectionSlug, "CONTENT_USAGE_GENERATION_CONFLICT");
    return {
        success: false,
        refreshedSourceCount: counts.refreshedSourceCount,
        deletedSourceCount: counts.deletedSourceCount,
        failedSourceCount: 0,
        errorCode: "CONTENT_USAGE_GENERATION_CONFLICT",
    };
}
function generationConflictResult(counts) {
    return {
        success: false,
        refreshedSourceCount: counts.refreshedSourceCount,
        deletedSourceCount: counts.deletedSourceCount,
        failedSourceCount: 0,
        errorCode: "CONTENT_USAGE_GENERATION_CONFLICT",
    };
}
async function contentCollectionExists(db, collectionSlug, collectionId) {
    let query = db.selectFrom("_emdash_collections").select("id").where("slug", "=", collectionSlug);
    if (collectionId)
        query = query.where("id", "=", collectionId);
    const row = await query.executeTakeFirst();
    return row !== undefined;
}
export async function deleteContentMediaUsage(db, collectionSlug, contentId) {
    validateIdentifier(collectionSlug, "collection slug");
    return withContentUsageCollectionLock(collectionSlug, () => withContentUsageLock(collectionSlug, contentId, () => deleteContentMediaUsageUnlocked(db, collectionSlug, contentId)));
}
async function deleteContentMediaUsageUnlocked(db, collectionSlug, contentId) {
    try {
        const deletedSourceCount = await new MediaUsageRepository(db).deleteContentSources(collectionSlug, contentId);
        return { ...ZERO_RESULT, deletedSourceCount };
    }
    catch (error) {
        console.error(`[media-usage] Failed to delete usage for ${collectionSlug}/${contentId}:`, error);
        await markContentMediaUsageCollectionStaleSafely(db, collectionSlug, "CONTENT_USAGE_DELETE_ERROR");
        return {
            success: false,
            refreshedSourceCount: 0,
            deletedSourceCount: 0,
            failedSourceCount: 0,
            errorCode: "CONTENT_USAGE_DELETE_ERROR",
        };
    }
}
export async function deleteContentMediaUsageCollection(db, collectionSlug) {
    validateIdentifier(collectionSlug, "collection slug");
    return withContentUsageCollectionLock(collectionSlug, () => deleteContentMediaUsageCollectionUnlocked(db, collectionSlug));
}
async function deleteContentMediaUsageCollectionUnlocked(db, collectionSlug) {
    try {
        const repo = new MediaUsageRepository(db);
        const deletedSourceCount = await repo.deleteCollectionSources(collectionSlug);
        await repo.deleteIndexStatus({
            adapterId: CONTENT_MEDIA_USAGE_ADAPTER_ID,
            scopeType: CONTENT_MEDIA_USAGE_COLLECTION_SCOPE,
            scopeKey: collectionSlug,
        });
        return { ...ZERO_RESULT, deletedSourceCount };
    }
    catch (error) {
        console.error(`[media-usage] Failed to delete usage for collection ${collectionSlug}:`, error);
        try {
            await new MediaUsageRepository(db).deleteIndexStatus({
                adapterId: CONTENT_MEDIA_USAGE_ADAPTER_ID,
                scopeType: CONTENT_MEDIA_USAGE_COLLECTION_SCOPE,
                scopeKey: collectionSlug,
            });
        }
        catch (statusError) {
            console.error(`[media-usage] Failed to clear usage status for deleted collection ${collectionSlug}:`, statusError);
        }
        return {
            success: false,
            refreshedSourceCount: 0,
            deletedSourceCount: 0,
            failedSourceCount: 0,
            errorCode: "CONTENT_USAGE_DELETE_ERROR",
        };
    }
}
export async function refreshContentMediaUsageAfterWrite(db, collectionSlug, contentId) {
    const result = await refreshContentMediaUsage(db, collectionSlug, contentId);
    if (!result.success) {
        console.error(`[media-usage] Usage refresh for ${collectionSlug}/${contentId} finished with ${result.errorCode}`);
    }
}
export async function findNonTranslatableSiblingContentIds(db, collectionSlug, updatedContentId, translationGroup, updatedData, options = {}) {
    if (!isI18nEnabled() || !updatedData || !translationGroup)
        return [];
    validateIdentifier(collectionSlug, "collection slug");
    const collection = await db
        .selectFrom("_emdash_collections")
        .select("id")
        .where("slug", "=", collectionSlug)
        .executeTakeFirst();
    if (!collection)
        return [];
    const fields = await db
        .selectFrom("_emdash_fields")
        .select("slug")
        .where("collection_id", "=", collection.id)
        .where("translatable", "=", 0)
        .execute();
    const touchedNonTranslatableSlugs = fields
        .filter((field) => options.absentAsCleared || field.slug in updatedData)
        .map((field) => field.slug);
    if (touchedNonTranslatableSlugs.length === 0)
        return [];
    const usageFields = await loadContentMediaUsageFields(db, collectionSlug);
    const usageRelevantSlugs = new Set([
        ...usageFields.extractionFields.map((field) => field.slug),
        ...usageFields.displayFieldSlugs,
    ]);
    if (!touchedNonTranslatableSlugs.some((slug) => usageRelevantSlugs.has(slug)))
        return [];
    const tableName = `ec_${collectionSlug}`;
    const rows = await sql `
		SELECT id
		FROM ${sql.ref(tableName)}
		WHERE translation_group = ${translationGroup}
		AND id != ${updatedContentId}
		ORDER BY id ASC
	`.execute(db);
    return rows.rows.map((row) => row.id);
}
async function markSnapshotFailure(db, collectionSlug, result) {
    const repo = new MediaUsageRepository(db);
    if (result.source) {
        await repo.markSourceAttempted({
            ...result.source,
            sourceCompleteness: "failed",
            lastErrorCode: result.error,
        });
    }
    await markContentMediaUsageCollectionStale(db, collectionSlug, result.error);
    return {
        success: false,
        refreshedSourceCount: 0,
        deletedSourceCount: 0,
        failedSourceCount: result.source ? 1 : 0,
        errorCode: result.error,
    };
}
function snapshotFailureResult(result) {
    return {
        success: false,
        refreshedSourceCount: 0,
        deletedSourceCount: 0,
        failedSourceCount: result.source ? 1 : 0,
        errorCode: result.error,
    };
}
async function deleteCanonicalContentSourcesIfAbsent(repo, observedSources, collectionSlug, contentId) {
    let deletedSourceCount = 0;
    for (const source of observedSources) {
        const result = await repo.deleteSourceIfMatchingContentAbsent(source.sourceKey, source, collectionSlug, contentId);
        if (result.deleted) {
            deletedSourceCount++;
            continue;
        }
        if (result.contentPresent || result.source) {
            return generationConflictResult({ refreshedSourceCount: 0, deletedSourceCount });
        }
    }
    return { ...ZERO_RESULT, deletedSourceCount };
}
async function withContentUsageLock(collectionSlug, contentId, fn) {
    const locks = getContentUsageLocks();
    const lockKey = `${collectionSlug}\0${contentId}`;
    const previous = locks.get(lockKey) ?? Promise.resolve();
    let releaseCurrent;
    const current = new Promise((resolve) => {
        releaseCurrent = resolve;
    });
    const next = previous.catch(() => { }).then(() => current);
    locks.set(lockKey, next);
    try {
        await previous.catch(() => { });
        return await fn();
    }
    finally {
        releaseCurrent();
        if (locks.get(lockKey) === next)
            locks.delete(lockKey);
    }
}
export async function withContentUsageCollectionLock(collectionSlug, fn) {
    // Coarse by design: row refreshes and collection source deletes must not interleave.
    const locks = getContentUsageCollectionLocks();
    const previous = locks.get(collectionSlug) ?? Promise.resolve();
    let releaseCurrent;
    const current = new Promise((resolve) => {
        releaseCurrent = resolve;
    });
    const next = previous.catch(() => { }).then(() => current);
    locks.set(collectionSlug, next);
    try {
        await previous.catch(() => { });
        return await fn();
    }
    finally {
        releaseCurrent();
        if (locks.get(collectionSlug) === next)
            locks.delete(collectionSlug);
    }
}
function getContentUsageLocks() {
    const global = globalThis;
    const existing = global[CONTENT_USAGE_LOCKS_KEY];
    // eslint-disable-next-line typescript/no-unsafe-type-assertion -- globalThis symbol slot stores only this map
    if (existing instanceof Map)
        return existing;
    const locks = new Map();
    global[CONTENT_USAGE_LOCKS_KEY] = locks;
    return locks;
}
function getContentUsageCollectionLocks() {
    const global = globalThis;
    const existing = global[CONTENT_USAGE_COLLECTION_LOCKS_KEY];
    // eslint-disable-next-line typescript/no-unsafe-type-assertion -- globalThis symbol slot stores only this map
    if (existing instanceof Map)
        return existing;
    const locks = new Map();
    global[CONTENT_USAGE_COLLECTION_LOCKS_KEY] = locks;
    return locks;
}
