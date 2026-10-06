// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// Whole pinned authority; finite import transports recorded in the runtime ledger.
import type { Kysely } from "kysely";

import { handlePluginDisable, handlePluginEnable } from "./handlers.ts";
import type { Database } from "./database-types.ts";
import type { SandboxedPluginEntry } from "./runtime-types.ts";
import { setCronTasksEnabled } from "./cron.ts";
import type { ResolvedPlugin } from "./types.ts";

export interface PluginLifecycleRuntime {
	db: Kysely<Database>;
	configuredPlugins: ResolvedPlugin[];
	sandboxedPluginEntries: SandboxedPluginEntry[];
	setPluginStatus(pluginId: string, status: "active" | "inactive"): Promise<void>;
	syncMarketplacePlugins(): Promise<void>;
	syncRegistryPlugins(): Promise<void>;
}

export async function enableRuntimePlugin(runtime: PluginLifecycleRuntime, pluginId: string) {
	const result = await handlePluginEnable(
		runtime.db,
		runtime.configuredPlugins,
		runtime.sandboxedPluginEntries,
		pluginId,
	);
	if (!result.success) return result;

	const source = result.data.item.source;
	if (source === "registry") await runtime.syncRegistryPlugins();
	else if (source === "marketplace") await runtime.syncMarketplacePlugins();
	await runtime.setPluginStatus(pluginId, "active");
	await setCronTasksEnabled(runtime.db, pluginId, true);
	return result;
}

export async function disableRuntimePlugin(runtime: PluginLifecycleRuntime, pluginId: string) {
	const result = await handlePluginDisable(
		runtime.db,
		runtime.configuredPlugins,
		runtime.sandboxedPluginEntries,
		pluginId,
	);
	if (!result.success) return result;

	await runtime.setPluginStatus(pluginId, "inactive");
	await setCronTasksEnabled(runtime.db, pluginId, false);
	return result;
}
