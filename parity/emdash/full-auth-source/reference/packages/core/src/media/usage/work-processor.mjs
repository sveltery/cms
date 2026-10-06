import { isPostgres } from "../../database/dialect-helpers.js";
import { MediaUsageWorkRepository, } from "../../database/repositories/media-usage-work.js";
import { MediaUsageRepository } from "../../database/repositories/media-usage.js";
import { withTransaction } from "../../database/transaction.js";
import { getRequestContext } from "../../request-context.js";
import { contentRefreshKey, refreshContentMediaUsageForWorkBatch, } from "./content-refresh.js";
export const MEDIA_USAGE_WORK_PROCESSING_LIMITS = Object.freeze({
    candidatesPerTick: 1_000,
    leaseDurationSeconds: 20 * 60,
    maxAttempts: 5,
    retryBaseSeconds: 30,
    retryMaxSeconds: 15 * 60,
    retryJitterRatio: 0.25,
});
export async function processMediaUsageWorkAfterWrite(db, collectionSlug, contentId) {
    if (!(await isIncrementalCaptureActive(db))) {
        return { outcome: "inactive", claimed: false };
    }
    await new MediaUsageRepository(db).recoverIncrementalFinalizations();
    const repo = new MediaUsageWorkRepository(db);
    const work = await repo.findWorkForContent(collectionSlug, contentId);
    if (!work)
        return { outcome: "not_due", claimed: false };
    const claimed = await repo.claimWork({
        collectionId: work.collectionId,
        contentId: work.contentId,
        workVersion: work.workVersion,
        leaseDurationSeconds: MEDIA_USAGE_WORK_PROCESSING_LIMITS.leaseDurationSeconds,
    });
    if (!claimed)
        return { outcome: "claim_lost", claimed: false };
    try {
        const processed = await runClaimedBatch(db, [claimed]);
        return processed.get(workResultKey(claimed)) ?? { outcome: "claim_lost", claimed: false };
    }
    catch (error) {
        const transitioned = await repo.retryClaimedWorkBatch({
            work: [workLease(claimed)],
            errorCode: "MEDIA_USAGE_PROCESSING_FAILED",
            retryDelaySeconds: MEDIA_USAGE_WORK_PROCESSING_LIMITS.retryBaseSeconds,
            maxAttempts: MEDIA_USAGE_WORK_PROCESSING_LIMITS.maxAttempts,
        });
        const outcome = transitioned.get(workIdentityKey(claimed)) ?? "superseded";
        if (outcome === "failed") {
            await new MediaUsageRepository(db).recordIncrementalFailure({
                collectionId: claimed.collectionId,
                collectionSlug: claimed.collectionSlug,
                contentId: claimed.contentId,
                workVersion: claimed.workVersion,
                errorCode: "MEDIA_USAGE_PROCESSING_FAILED",
            });
        }
        console.error("[media-usage:work] Immediate processing failed:", error);
        return { outcome, claimed: true };
    }
}
export async function processDueMediaUsageWork(db, options = {}) {
    const startedAt = Date.now();
    const result = {
        candidateCount: 0,
        claimedCount: 0,
        completedCount: 0,
        retryCount: 0,
        failedCount: 0,
        supersededCount: 0,
        obsoleteCount: 0,
        durationMs: 0,
    };
    if (!options.activationKnownActive && !(await isIncrementalCaptureActive(db))) {
        result.durationMs = Date.now() - startedAt;
        return result;
    }
    await new MediaUsageRepository(db).recoverIncrementalFinalizations();
    const repo = new MediaUsageWorkRepository(db);
    const candidates = await repo.claimDueWorkBatch({
        limit: MEDIA_USAGE_WORK_PROCESSING_LIMITS.candidatesPerTick,
        leaseDurationSeconds: MEDIA_USAGE_WORK_PROCESSING_LIMITS.leaseDurationSeconds,
    });
    result.candidateCount =
        candidates.length > 0 || !(await repo.hasNonterminalWork()) ? candidates.length : 1;
    const processedBatch = await processClaimedCollections(db, candidates);
    for (const candidate of candidates) {
        const processed = processedBatch.get(workResultKey(candidate)) ?? {
            outcome: "claim_lost",
            claimed: false,
        };
        if (processed.claimed)
            result.claimedCount++;
        if (processed.outcome === "completed")
            result.completedCount++;
        if (processed.outcome === "retry")
            result.retryCount++;
        if (processed.outcome === "failed")
            result.failedCount++;
        if (processed.outcome === "superseded")
            result.supersededCount++;
        if (processed.outcome === "obsolete")
            result.obsoleteCount++;
    }
    result.durationMs = Date.now() - startedAt;
    return result;
}
async function processClaimedCollections(db, candidates) {
    const processed = new Map();
    const byCollection = new Map();
    for (const candidate of candidates) {
        const key = collectionResultKey(candidate);
        const collection = byCollection.get(key) ?? [];
        collection.push(candidate);
        byCollection.set(key, collection);
    }
    for (const collection of byCollection.values()) {
        try {
            for (const [key, result] of await runClaimedBatch(db, collection)) {
                processed.set(key, result);
            }
        }
        catch (error) {
            for (const [key, result] of await retryFailedClaimedCollection(db, collection)) {
                processed.set(key, result);
            }
            console.error("[media-usage:work] Collection processing failed:", error);
        }
    }
    return processed;
}
async function retryFailedClaimedCollection(db, candidates) {
    const transitioned = await new MediaUsageWorkRepository(db).retryClaimedWorkBatch({
        work: candidates.map(workLease),
        errorCode: "MEDIA_USAGE_PROCESSING_FAILED",
        retryDelaySeconds: MEDIA_USAGE_WORK_PROCESSING_LIMITS.retryBaseSeconds,
        maxAttempts: MEDIA_USAGE_WORK_PROCESSING_LIMITS.maxAttempts,
    });
    const processed = new Map();
    const failedCollectionIds = new Set();
    for (const candidate of candidates) {
        const state = transitioned.get(workIdentityKey(candidate));
        if (state === "failed")
            failedCollectionIds.add(candidate.collectionId);
        processed.set(workResultKey(candidate), {
            outcome: state ?? "superseded",
            claimed: true,
        });
    }
    await new MediaUsageRepository(db).recordIncrementalFailuresByCollection({
        collectionIds: [...failedCollectionIds],
        errorCode: "MEDIA_USAGE_PROCESSING_FAILED",
    });
    return processed;
}
async function runClaimedBatch(db, candidates) {
    return isPostgres(db)
        ? withTransaction(db, (trx) => processClaimedBatch(trx, new MediaUsageWorkRepository(trx), candidates))
        : processClaimedBatch(db, new MediaUsageWorkRepository(db), candidates);
}
async function processClaimedBatch(db, repo, candidates) {
    const results = new Map();
    const locked = await repo.lockClaimedWorkBatch(candidates.map(workLease));
    const owned = [];
    for (const candidate of candidates) {
        if (locked.has(workIdentityKey(candidate)))
            owned.push(candidate);
        else {
            results.set(workResultKey(candidate), { outcome: "superseded", claimed: true });
        }
    }
    const currentCollections = await findCurrentCollectionIdentities(db, owned);
    const current = [];
    const obsolete = [];
    for (const candidate of owned) {
        if (currentCollections.has(collectionResultKey(candidate)))
            current.push(candidate);
        else
            obsolete.push(candidate);
    }
    const obsoleteCompleted = await repo.completeWorkBatch(obsolete.map(workLease));
    for (const candidate of obsolete) {
        results.set(workResultKey(candidate), {
            outcome: obsoleteCompleted.has(workIdentityKey(candidate)) ? "obsolete" : "superseded",
            claimed: true,
        });
    }
    if (current.length === 0)
        return results;
    const refreshes = await refreshContentMediaUsageForWorkBatch(db, current, {
        shouldContinue: canContinueBulkWork,
    });
    const successful = [];
    const unstarted = [];
    const failedRefreshes = [];
    for (const candidate of current) {
        const refresh = refreshes.get(contentRefreshKey(candidate.collectionId, candidate.contentId));
        if (refresh?.success)
            successful.push(candidate);
        else if (!refresh)
            unstarted.push(candidate);
        else
            failedRefreshes.push({ candidate, refresh });
    }
    const terminalFailureCollections = new Map();
    const failureGroups = new Map();
    for (const failure of failedRefreshes) {
        const errorCode = processingErrorCode(failure.refresh.errorCode);
        const terminal = errorCode === "MEDIA_USAGE_RESOURCE_LIMIT" ||
            failure.candidate.attemptCount + 1 >= MEDIA_USAGE_WORK_PROCESSING_LIMITS.maxAttempts;
        const delay = retryDelaySeconds(failure.candidate.attemptCount);
        const key = `${errorCode}\u0000${terminal ? "terminal" : String(delay)}`;
        const group = failureGroups.get(key) ?? {
            errorCode,
            retryDelaySeconds: delay,
            terminal,
            candidates: [],
        };
        group.candidates.push(failure.candidate);
        failureGroups.set(key, group);
    }
    for (const group of failureGroups.values()) {
        const transitioned = await repo.retryClaimedWorkBatch({
            work: group.candidates.map(workLease),
            errorCode: group.errorCode,
            retryDelaySeconds: group.retryDelaySeconds,
            maxAttempts: group.terminal ? 1 : MEDIA_USAGE_WORK_PROCESSING_LIMITS.maxAttempts,
        });
        for (const candidate of group.candidates) {
            const state = transitioned.get(workIdentityKey(candidate));
            if (state === "failed") {
                const collections = terminalFailureCollections.get(group.errorCode) ?? new Set();
                collections.add(candidate.collectionId);
                terminalFailureCollections.set(group.errorCode, collections);
            }
            results.set(workResultKey(candidate), {
                outcome: state ?? "superseded",
                claimed: true,
            });
        }
    }
    for (const [errorCode, collectionIds] of terminalFailureCollections) {
        await new MediaUsageRepository(db).recordIncrementalFailuresByCollection({
            collectionIds: [...collectionIds],
            errorCode,
        });
    }
    const released = await repo.releaseClaimedWorkBatch(unstarted.map(workLease));
    for (const candidate of unstarted) {
        results.set(workResultKey(candidate), {
            outcome: released.has(workIdentityKey(candidate)) ? "not_due" : "superseded",
            claimed: true,
        });
    }
    const usage = new MediaUsageRepository(db);
    const successfulByCollection = new Map();
    for (const candidate of successful) {
        const key = collectionResultKey(candidate);
        const collection = successfulByCollection.get(key) ?? [];
        collection.push(candidate);
        successfulByCollection.set(key, collection);
    }
    const readyToComplete = [];
    const deferredCompletion = [];
    const lostFinalization = [];
    let pendingFinalizationQueries = 2;
    for (const collection of successfulByCollection.values()) {
        const first = collection[0];
        if (!first)
            continue;
        const metrics = getRequestContext()?.metrics;
        if (metrics && metrics.dbCount + pendingFinalizationQueries + 4 > 900) {
            deferredCompletion.push(...collection);
            continue;
        }
        const finalization = await usage.prepareIncrementalFinalization({
            collectionId: first.collectionId,
            collectionSlug: first.collectionSlug,
        });
        if (finalization.outcome !== "lost") {
            readyToComplete.push(...collection);
            pendingFinalizationQueries += 2;
            continue;
        }
        lostFinalization.push(...collection);
        pendingFinalizationQueries += 2;
    }
    const lostTransitions = await repo.retryClaimedWorkBatch({
        work: lostFinalization.map(workLease),
        errorCode: "MEDIA_USAGE_GENERATION_CONFLICT",
        retryDelaySeconds: MEDIA_USAGE_WORK_PROCESSING_LIMITS.retryBaseSeconds,
        maxAttempts: MEDIA_USAGE_WORK_PROCESSING_LIMITS.maxAttempts,
    });
    const lostFailedCollections = new Set();
    for (const candidate of lostFinalization) {
        const state = lostTransitions.get(workIdentityKey(candidate));
        if (state === "failed")
            lostFailedCollections.add(candidate.collectionId);
        results.set(workResultKey(candidate), {
            outcome: state ?? "superseded",
            claimed: true,
        });
    }
    await usage.recordIncrementalFailuresByCollection({
        collectionIds: [...lostFailedCollections],
        errorCode: "MEDIA_USAGE_GENERATION_CONFLICT",
    });
    const deferred = await repo.releaseClaimedWorkBatch(deferredCompletion.map(workLease));
    for (const candidate of deferredCompletion) {
        results.set(workResultKey(candidate), {
            outcome: deferred.has(workIdentityKey(candidate)) ? "not_due" : "superseded",
            claimed: true,
        });
    }
    const completed = await repo.completeWorkBatch(readyToComplete.map(workLease));
    const completedCollections = new Map();
    for (const candidate of readyToComplete) {
        const didComplete = completed.has(workIdentityKey(candidate));
        results.set(workResultKey(candidate), {
            outcome: didComplete ? "completed" : "superseded",
            claimed: true,
        });
        if (didComplete)
            completedCollections.set(collectionResultKey(candidate), candidate);
    }
    for (const collection of completedCollections.values()) {
        await usage.recordIncrementalSuccess({
            collectionId: collection.collectionId,
            collectionSlug: collection.collectionSlug,
        });
    }
    return results;
}
async function findCurrentCollectionIdentities(db, candidates) {
    const identities = new Map(candidates.map((candidate) => [collectionResultKey(candidate), candidate]));
    const current = new Set();
    for (const batch of chunkCollectionIds(Array.from(identities.values(), (item) => item.collectionId))) {
        const rows = await db
            .selectFrom("_emdash_collections")
            .select(["id", "slug"])
            .where("id", "in", batch)
            .execute();
        for (const row of rows)
            current.add(`${row.id}\u0000${row.slug}`);
    }
    return current;
}
function workLease(work) {
    if (!work.leaseToken)
        throw new Error("Claimed media usage work requires a lease token");
    return {
        collectionId: work.collectionId,
        contentId: work.contentId,
        workVersion: work.workVersion,
        leaseToken: work.leaseToken,
    };
}
function workIdentityKey(work) {
    return `${work.collectionId}\u0000${work.contentId}\u0000${String(work.workVersion)}`;
}
function workResultKey(work) {
    return workIdentityKey(work);
}
function collectionResultKey(work) {
    return `${work.collectionId}\u0000${work.collectionSlug}`;
}
function chunkCollectionIds(ids) {
    const unique = [...new Set(ids)];
    const batches = [];
    for (let index = 0; index < unique.length; index += 50) {
        batches.push(unique.slice(index, index + 50));
    }
    return batches;
}
function canContinueBulkWork() {
    const metrics = getRequestContext()?.metrics;
    return !metrics || metrics.dbCount + 150 <= 900;
}
async function isIncrementalCaptureActive(db) {
    const row = await db
        .selectFrom("_emdash_media_usage_activation")
        .select("state")
        .where("task_key", "=", "incremental_capture")
        .executeTakeFirst();
    return row?.state === "active";
}
function retryDelaySeconds(attemptCount) {
    const exponential = Math.min(MEDIA_USAGE_WORK_PROCESSING_LIMITS.retryMaxSeconds, MEDIA_USAGE_WORK_PROCESSING_LIMITS.retryBaseSeconds * 2 ** attemptCount);
    const jitter = Math.floor(exponential * MEDIA_USAGE_WORK_PROCESSING_LIMITS.retryJitterRatio * Math.random());
    return Math.min(MEDIA_USAGE_WORK_PROCESSING_LIMITS.retryMaxSeconds, exponential + jitter);
}
function processingErrorCode(errorCode) {
    if (errorCode === "DRAFT_REVISION_NOT_FOUND" ||
        errorCode === "DRAFT_REVISION_MISMATCH" ||
        errorCode === "DRAFT_REVISION_INVALID") {
        return "MEDIA_USAGE_SNAPSHOT_FAILED";
    }
    if (errorCode === "CONTENT_USAGE_GENERATION_CONFLICT") {
        return "MEDIA_USAGE_GENERATION_CONFLICT";
    }
    if (errorCode === "CONTENT_USAGE_RESOURCE_LIMIT")
        return "MEDIA_USAGE_RESOURCE_LIMIT";
    return "MEDIA_USAGE_PROCESSING_FAILED";
}
