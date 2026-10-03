// EmDash1.1.0 immutable 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; source blob 60d26809dca8e482fe209643631f389d6b346aac.
// Copyright2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt. Native imports/table/host substitutions.
import type { Kysely } from "kysely";

import { OptionsRepository } from "../options.ts";
import type { SettingsTables as Database } from "../tables.ts";

export const SCHEDULER_HEARTBEAT_OPTION = "system:scheduler:last_completed_at";
export const SCHEDULER_STALE_AFTER_MS = 5 * 60 * 1000;

export interface SchedulerHealth {
	status: "healthy" | "stale" | "unknown";
	lastCompletedAt: string | null;
}

export async function recordSchedulerHeartbeat(
	db: Kysely<Database>,
	completedAt = new Date(),
): Promise<void> {
	await new OptionsRepository(db).set(SCHEDULER_HEARTBEAT_OPTION, completedAt.toISOString());
}

export async function recordSchedulerHeartbeatSafely(
	db: Kysely<Database>,
	completedAt = new Date(),
): Promise<void> {
	try {
		await recordSchedulerHeartbeat(db, completedAt);
	} catch (error) {
		console.error("[scheduler] Failed to record heartbeat:", error);
	}
}

export async function getSchedulerHealth(
	db: Kysely<Database>,
	now = new Date(),
): Promise<SchedulerHealth> {
	const lastCompletedAt = await new OptionsRepository(db).get<string>(SCHEDULER_HEARTBEAT_OPTION);
	const lastCompletedAtMs = lastCompletedAt ? Date.parse(lastCompletedAt) : Number.NaN;
	if (!lastCompletedAt || Number.isNaN(lastCompletedAtMs)) {
		return { status: "unknown", lastCompletedAt: null };
	}

	return {
		status: now.getTime() - lastCompletedAtMs > SCHEDULER_STALE_AFTER_MS ? "stale" : "healthy",
		lastCompletedAt,
	};
}
