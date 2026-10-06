/**
 * Plugin Manager v2
 *
 * Central orchestrator for the plugin system:
 * - Loads and resolves plugins
 * - Manages plugin lifecycle (install, activate, deactivate, uninstall)
 * - Dispatches hooks across all plugins
 * - Routes API requests to plugins
 *
 */
import { sql } from "kysely";
import { OptionsRepository } from "../database/repositories/options.js";
import { setCronTasksEnabled } from "./cron.js";
import { definePlugin } from "./define-plugin.js";
import { HookPipeline, resolveExclusiveHooks as resolveExclusiveHooksShared, } from "./hooks.js";
import { PluginRouteRegistry } from "./routes.js";
/** Options table key prefix for exclusive hook DB reads via PluginManager */
const EXCLUSIVE_HOOK_KEY_PREFIX = "emdash:exclusive_hook:";
/**
 * Plugin Manager v2
 *
 * Manages the full lifecycle of plugins and coordinates hooks/routes.
 */
export class PluginManager {
    options;
    plugins = new Map();
    hookPipeline = null;
    routeRegistry = null;
    factoryOptions;
    initialized = false;
    constructor(options) {
        this.options = options;
        this.factoryOptions = {
            db: options.db,
            storage: options.storage,
            getUploadUrl: options.getUploadUrl,
            trustedProxyHeaders: options.trustedProxyHeaders,
        };
    }
    /**
     * Set the email pipeline used when creating plugin contexts.
     * Reinitializes routes/hooks if already initialized so ctx.email is available immediately.
     */
    setEmailPipeline(pipeline) {
        this.factoryOptions.emailPipeline = pipeline;
        if (this.initialized) {
            this.reinitialize();
        }
    }
    // =========================================================================
    // Plugin Registration
    // =========================================================================
    /**
     * Register a plugin definition
     * This resolves the definition and adds it to the manager, but doesn't install it
     */
    register(definition) {
        const resolved = definePlugin(definition);
        if (this.plugins.has(resolved.id)) {
            throw new Error(`Plugin "${resolved.id}" is already registered`);
        }
        this.plugins.set(resolved.id, {
            plugin: resolved,
            state: "registered",
        });
        // Mark as needing reinitialization
        this.initialized = false;
        return resolved;
    }
    /**
     * Register multiple plugins
     */
    registerAll(definitions) {
        for (const def of definitions) {
            this.register(def);
        }
    }
    /**
     * Unregister a plugin
     * Plugin must be inactive or just registered
     */
    unregister(pluginId) {
        const entry = this.plugins.get(pluginId);
        if (!entry)
            return false;
        if (entry.state === "active") {
            throw new Error(`Cannot unregister active plugin "${pluginId}". Deactivate it first.`);
        }
        this.plugins.delete(pluginId);
        this.initialized = false;
        return true;
    }
    // =========================================================================
    // Plugin Lifecycle
    // =========================================================================
    /**
     * Install a plugin (run install hooks, set up storage)
     */
    async install(pluginId) {
        const entry = this.plugins.get(pluginId);
        if (!entry) {
            throw new Error(`Plugin "${pluginId}" not found`);
        }
        if (entry.state !== "registered") {
            throw new Error(`Plugin "${pluginId}" is already installed (state: ${entry.state})`);
        }
        this.ensureInitialized();
        // Run install hooks
        const results = await this.hookPipeline.runPluginInstall(pluginId);
        // Check for errors
        const failed = results.find((r) => !r.success);
        if (failed) {
            throw new Error(`Plugin install failed: ${failed.error?.message ?? "Unknown error"}`);
        }
        entry.state = "installed";
        return results;
    }
    /**
     * Activate a plugin (run activate hooks, enable hooks/routes)
     */
    async activate(pluginId) {
        const entry = this.plugins.get(pluginId);
        if (!entry) {
            throw new Error(`Plugin "${pluginId}" not found`);
        }
        if (entry.state === "active") {
            return []; // Already active
        }
        if (entry.state === "registered") {
            // Auto-install if not installed
            await this.install(pluginId);
        }
        this.ensureInitialized();
        // Run activate hooks
        const results = await this.hookPipeline.runPluginActivate(pluginId);
        // Check for errors
        const failed = results.find((r) => !r.success);
        if (failed) {
            throw new Error(`Plugin activation failed: ${failed.error?.message ?? "Unknown error"}`);
        }
        entry.state = "active";
        // Re-enable cron tasks for the activated plugin
        await setCronTasksEnabled(this.options.db, pluginId, true);
        // Reinitialize pipeline so the newly active plugin's hooks are registered
        this.reinitialize();
        // Resolve exclusive hooks (new provider may need auto-selection)
        await this.resolveExclusiveHooks();
        return results;
    }
    /**
     * Deactivate a plugin (run deactivate hooks, disable hooks/routes)
     */
    async deactivate(pluginId) {
        const entry = this.plugins.get(pluginId);
        if (!entry) {
            throw new Error(`Plugin "${pluginId}" not found`);
        }
        if (entry.state !== "active") {
            return []; // Not active
        }
        this.ensureInitialized();
        // Run deactivate hooks
        const results = await this.hookPipeline.runPluginDeactivate(pluginId);
        // Disable cron tasks for the deactivated plugin
        await setCronTasksEnabled(this.options.db, pluginId, false);
        entry.state = "inactive";
        // Reinitialize pipeline so the deactivated plugin's hooks are removed
        this.reinitialize();
        // Resolve exclusive hooks (deactivated provider may need clearing)
        await this.resolveExclusiveHooks();
        return results;
    }
    /**
     * Uninstall a plugin (run uninstall hooks, optionally delete data)
     */
    async uninstall(pluginId, deleteData = false) {
        const entry = this.plugins.get(pluginId);
        if (!entry) {
            throw new Error(`Plugin "${pluginId}" not found`);
        }
        // Deactivate first if active (this also resolves exclusive hooks)
        if (entry.state === "active") {
            await this.deactivate(pluginId);
        }
        this.ensureInitialized();
        // Run uninstall hooks
        const results = await this.hookPipeline.runPluginUninstall(pluginId, deleteData);
        // Delete all cron tasks for the uninstalled plugin
        await this.deleteCronTasks(pluginId);
        // Remove from manager
        this.plugins.delete(pluginId);
        this.initialized = false;
        // Resolve exclusive hooks after removal
        await this.resolveExclusiveHooks();
        return results;
    }
    // =========================================================================
    // Hook Dispatch
    // =========================================================================
    /**
     * Run content:beforeSave hooks across all active plugins
     */
    async runContentBeforeSave(content, collection, isNew, id, actor, details) {
        this.ensureInitialized();
        return this.hookPipeline.runContentBeforeSave(content, collection, isNew, id, actor, details);
    }
    /**
     * Run content:afterSave hooks across all active plugins
     */
    async runContentAfterSave(content, collection, isNew, actor, details) {
        this.ensureInitialized();
        return this.hookPipeline.runContentAfterSave(content, collection, isNew, actor, undefined, details);
    }
    /**
     * Run content:beforeDelete hooks across all active plugins
     */
    async runContentBeforeDelete(id, collection) {
        this.ensureInitialized();
        return this.hookPipeline.runContentBeforeDelete(id, collection);
    }
    /**
     * Run content:afterDelete hooks across all active plugins
     */
    async runContentAfterDelete(id, collection, permanent) {
        this.ensureInitialized();
        return this.hookPipeline.runContentAfterDelete(id, collection, permanent);
    }
    /**
     * Run content:afterPublish hooks across all active plugins
     */
    async runContentAfterPublish(content, collection) {
        this.ensureInitialized();
        return this.hookPipeline.runContentAfterPublish(content, collection);
    }
    /**
     * Run content:afterUnpublish hooks across all active plugins
     */
    async runContentAfterUnpublish(content, collection) {
        this.ensureInitialized();
        return this.hookPipeline.runContentAfterUnpublish(content, collection);
    }
    /**
     * Run content:afterRestore hooks across all active plugins
     */
    async runContentAfterRestore(content, collection) {
        this.ensureInitialized();
        return this.hookPipeline.runContentAfterRestore(content, collection);
    }
    /**
     * Run content:afterSchedule hooks across all active plugins
     */
    async runContentAfterSchedule(content, collection) {
        this.ensureInitialized();
        return this.hookPipeline.runContentAfterSchedule(content, collection);
    }
    /**
     * Run content:afterUnschedule hooks across all active plugins
     */
    async runContentAfterUnschedule(content, collection) {
        this.ensureInitialized();
        return this.hookPipeline.runContentAfterUnschedule(content, collection);
    }
    /**
     * Run media:beforeUpload hooks across all active plugins
     */
    async runMediaBeforeUpload(file) {
        this.ensureInitialized();
        return this.hookPipeline.runMediaBeforeUpload(file);
    }
    /**
     * Run media:afterUpload hooks across all active plugins
     */
    async runMediaAfterUpload(media) {
        this.ensureInitialized();
        return this.hookPipeline.runMediaAfterUpload(media);
    }
    /**
     * Invoke the cron hook for a specific plugin (per-plugin dispatch).
     * Used as the InvokeCronHookFn callback for CronExecutor.
     */
    async invokeCronHook(pluginId, event) {
        this.ensureInitialized();
        const result = await this.hookPipeline.invokeCronHook(pluginId, event);
        if (!result.success && result.error) {
            throw result.error;
        }
    }
    // =========================================================================
    // Route Dispatch
    // =========================================================================
    /**
     * Invoke a plugin route
     */
    async invokeRoute(pluginId, routeName, options) {
        this.ensureInitialized();
        return this.routeRegistry.invoke(pluginId, routeName, options);
    }
    /**
     * Get all routes for a plugin
     */
    getPluginRoutes(pluginId) {
        this.ensureInitialized();
        return this.routeRegistry.getRoutes(pluginId);
    }
    // =========================================================================
    // Query Methods
    // =========================================================================
    /**
     * Get a plugin by ID
     */
    getPlugin(pluginId) {
        return this.plugins.get(pluginId)?.plugin;
    }
    /**
     * Get plugin state
     */
    getPluginState(pluginId) {
        return this.plugins.get(pluginId)?.state;
    }
    /**
     * Get all registered plugins
     */
    getAllPlugins() {
        return Array.from(this.plugins.values(), (entry) => ({
            plugin: entry.plugin,
            state: entry.state,
        }));
    }
    /**
     * Get all active plugins
     */
    getActivePlugins() {
        return [...this.plugins.values()]
            .filter((entry) => entry.state === "active")
            .map((entry) => entry.plugin);
    }
    /**
     * Check if a plugin exists
     */
    hasPlugin(pluginId) {
        return this.plugins.has(pluginId);
    }
    /**
     * Check if a plugin is active
     */
    isActive(pluginId) {
        return this.plugins.get(pluginId)?.state === "active";
    }
    // =========================================================================
    // Exclusive Hooks
    // =========================================================================
    /**
     * Get all plugins that registered a handler for an exclusive hook.
     */
    getExclusiveHookProviders(hookName) {
        this.ensureInitialized();
        return this.hookPipeline.getExclusiveHookProviders(hookName).map((p) => {
            const plugin = this.plugins.get(p.pluginId);
            return {
                pluginId: p.pluginId,
                pluginName: plugin?.plugin.id ?? p.pluginId,
            };
        });
    }
    /**
     * Read the selected provider for an exclusive hook from the options table.
     */
    async getExclusiveHookSelection(hookName) {
        const optionsRepo = new OptionsRepository(this.options.db);
        return optionsRepo.get(`${EXCLUSIVE_HOOK_KEY_PREFIX}${hookName}`);
    }
    /**
     * Set the selected provider for an exclusive hook in the options table.
     * Pass null to clear the selection.
     */
    async setExclusiveHookSelection(hookName, pluginId) {
        const optionsRepo = new OptionsRepository(this.options.db);
        const key = `${EXCLUSIVE_HOOK_KEY_PREFIX}${hookName}`;
        if (pluginId === null) {
            await optionsRepo.delete(key);
            this.hookPipeline?.clearExclusiveSelection(hookName);
            return;
        }
        // Validate plugin exists and is active
        const entry = this.plugins.get(pluginId);
        if (!entry) {
            throw new Error(`Plugin "${pluginId}" not found`);
        }
        if (entry.state !== "active") {
            throw new Error(`Plugin "${pluginId}" is not active`);
        }
        await optionsRepo.set(key, pluginId);
        this.hookPipeline?.setExclusiveSelection(hookName, pluginId);
    }
    /**
     * Resolution algorithm for exclusive hooks.
     *
     * Delegates to the shared resolveExclusiveHooks() function.
     * See hooks.ts for the full algorithm description.
     */
    async resolveExclusiveHooks(preferredHints) {
        this.ensureInitialized();
        const optionsRepo = new OptionsRepository(this.options.db);
        await resolveExclusiveHooksShared({
            pipeline: this.hookPipeline,
            isActive: (pluginId) => this.isActive(pluginId),
            getOption: (key) => optionsRepo.get(key),
            getOptions: (keys) => optionsRepo.getMany(keys),
            setOption: (key, value) => optionsRepo.set(key, value),
            deleteOption: async (key) => {
                await optionsRepo.delete(key);
            },
            preferredHints,
        });
    }
    /**
     * Get all exclusive hooks with their providers and current selections.
     * Used by the admin API.
     */
    async getExclusiveHooksInfo() {
        this.ensureInitialized();
        const exclusiveHookNames = this.hookPipeline.getRegisteredExclusiveHooks();
        const result = [];
        for (const hookName of exclusiveHookNames) {
            const providers = this.hookPipeline.getExclusiveHookProviders(hookName);
            const selection = await this.getExclusiveHookSelection(hookName);
            result.push({
                hookName,
                providers,
                selectedPluginId: selection,
            });
        }
        return result;
    }
    // =========================================================================
    // Internal Methods
    // =========================================================================
    /**
     * Initialize or reinitialize the hook pipeline and route registry
     */
    ensureInitialized() {
        if (this.initialized)
            return;
        // Get all active plugins for hooks
        const activePlugins = this.getActivePlugins();
        // Create hook pipeline with active plugins
        this.hookPipeline = new HookPipeline(activePlugins, this.factoryOptions);
        // Create route registry
        this.routeRegistry = new PluginRouteRegistry(this.factoryOptions);
        // Register routes for active plugins
        for (const plugin of activePlugins) {
            this.routeRegistry.register(plugin);
        }
        this.initialized = true;
    }
    /**
     * Force reinitialization (useful after plugin state changes)
     */
    reinitialize() {
        this.initialized = false;
        this.ensureInitialized();
    }
    /**
     * Delete all cron tasks for a plugin.
     * Used during uninstall.
     */
    async deleteCronTasks(pluginId) {
        try {
            await sql `
				DELETE FROM _emdash_cron_tasks
				WHERE plugin_id = ${pluginId}
			`.execute(this.options.db);
        }
        catch {
            // Cron table may not exist yet (pre-migration). Non-fatal.
        }
    }
}
/**
 * Create a plugin manager
 */
export function createPluginManager(options) {
    return new PluginManager(options);
}
