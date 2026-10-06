import { handlePluginDisable, handlePluginEnable } from "../api/handlers/plugins.js";
import { setCronTasksEnabled } from "./cron.js";
export async function enableRuntimePlugin(runtime, pluginId) {
    const result = await handlePluginEnable(runtime.db, runtime.configuredPlugins, runtime.sandboxedPluginEntries, pluginId);
    if (!result.success)
        return result;
    const source = result.data.item.source;
    if (source === "registry")
        await runtime.syncRegistryPlugins();
    else if (source === "marketplace")
        await runtime.syncMarketplacePlugins();
    await runtime.setPluginStatus(pluginId, "active");
    await setCronTasksEnabled(runtime.db, pluginId, true);
    return result;
}
export async function disableRuntimePlugin(runtime, pluginId) {
    const result = await handlePluginDisable(runtime.db, runtime.configuredPlugins, runtime.sandboxedPluginEntries, pluginId);
    if (!result.success)
        return result;
    await runtime.setPluginStatus(pluginId, "inactive");
    await setCronTasksEnabled(runtime.db, pluginId, false);
    return result;
}
