import { OptionsRepository } from "./database/repositories/options.js";
export const SCHEDULER_HEARTBEAT_OPTION = "system:scheduler:last_completed_at";
export const SCHEDULER_STALE_AFTER_MS = 5 * 60 * 1000;
export async function recordSchedulerHeartbeat(db, completedAt = new Date()) {
    await new OptionsRepository(db).set(SCHEDULER_HEARTBEAT_OPTION, completedAt.toISOString());
}
export async function recordSchedulerHeartbeatSafely(db, completedAt = new Date()) {
    try {
        await recordSchedulerHeartbeat(db, completedAt);
    }
    catch (error) {
        console.error("[scheduler] Failed to record heartbeat:", error);
    }
}
export async function getSchedulerHealth(db, now = new Date()) {
    const lastCompletedAt = await new OptionsRepository(db).get(SCHEDULER_HEARTBEAT_OPTION);
    const lastCompletedAtMs = lastCompletedAt ? Date.parse(lastCompletedAt) : Number.NaN;
    if (!lastCompletedAt || Number.isNaN(lastCompletedAtMs)) {
        return { status: "unknown", lastCompletedAt: null };
    }
    return {
        status: now.getTime() - lastCompletedAtMs > SCHEDULER_STALE_AFTER_MS ? "stale" : "healthy",
        lastCompletedAt,
    };
}
