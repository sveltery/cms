/**
 * Plugin Hooks System v2
 *
 * Uses the unified PluginContext for all hooks.
 * Manages lifecycle hooks with:
 * - Deterministic ordering via priority + dependencies
 * - Timeout enforcement
 * - Error isolation
 * - Observability
 *
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { toBylineInfo } from "./byline-access.js";
import { inspectContentPolicyDecision } from "./content-policy.js";
import { PluginContextFactory } from "./context.js";
const CONTENT_SAVE_HOOK_CONTEXT_KEY = Symbol.for("emdash:content-save-hook-context");
const contentSaveHookContext = globalThis[CONTENT_SAVE_HOOK_CONTEXT_KEY] ?? new AsyncLocalStorage();
globalThis[CONTENT_SAVE_HOOK_CONTEXT_KEY] = contentSaveHookContext;
export function getActiveContentSaveHookName() {
    return contentSaveHookContext.getStore();
}
function assignSaveHookDetails(event, details) {
    if (details.locale !== undefined)
        event.locale = details.locale;
    if (details.translationOf !== undefined)
        event.translationOf = details.translationOf;
}
/**
 * Hook pipeline for executing hooks in order
 */
export class HookPipeline {
    hooks = new Map();
    pluginMap = new Map();
    contextFactory = null;
    /** Stored so setContextFactory can merge incrementally. */
    contextFactoryOptions = {};
    /** Hook names where at least one handler declared exclusive: true */
    exclusiveHookNames = new Set();
    /**
     * Selected provider plugin ID for each exclusive hook.
     * Set by the PluginManager after resolution.
     */
    exclusiveSelections = new Map();
    constructor(plugins, factoryOptions) {
        if (factoryOptions) {
            this.contextFactory = new PluginContextFactory(factoryOptions);
            this.contextFactoryOptions = { ...factoryOptions };
        }
        for (const plugin of plugins) {
            this.pluginMap.set(plugin.id, plugin);
        }
        this.registerPlugins(plugins);
    }
    /**
     * Set or update the context factory options.
     *
     * When called on a pipeline that already has a factory, the new options
     * are merged on top of the existing ones so that callers don't need to
     * repeat every field (e.g. adding `cronReschedule` without losing
     * `storage` / `getUploadUrl`).
     */
    setContextFactory(options) {
        const merged = { ...this.contextFactoryOptions, ...options };
        // The first call must include `db`; subsequent calls merge incrementally.
        this.contextFactory = new PluginContextFactory(merged);
        this.contextFactoryOptions = merged;
    }
    /**
     * Get context for a plugin
     */
    getContext(pluginId) {
        const plugin = this.pluginMap.get(pluginId);
        if (!plugin) {
            throw new Error(`Plugin "${pluginId}" not found`);
        }
        if (!this.contextFactory) {
            throw new Error("Context factory not initialized - call setContextFactory first");
        }
        return this.contextFactory.createContext(plugin);
    }
    /**
     * Get typed hooks for a specific hook name.
     * The internal map stores ResolvedHook<unknown>, but we know each name
     * maps to a specific handler type via HookHandlerMap.
     *
     * Exclusive hooks that have a selected provider are filtered out — they
     * should only run via invokeExclusiveHook(), not in the regular pipeline.
     */
    getTypedHooks(name) {
        // The map stores hooks as ResolvedHook<unknown>. Each hook name corresponds
        // to a specific handler type. The cast here is the single point where we
        // bridge the untyped map to the typed API — callers never need to cast.
        const all = (this.hooks.get(name) ?? []);
        // If this hook has an exclusive selection, filter out all exclusive handlers
        // so they don't run in the regular pipeline
        if (this.exclusiveSelections.has(name)) {
            return all.filter((h) => !h.exclusive);
        }
        return all;
    }
    /**
     * Register all hooks from plugins.
     *
     * Registers each hook name individually to preserve type safety. The
     * internal map stores ResolvedHook<unknown> since it's keyed by string,
     * but getTypedHooks() restores the correct handler type on retrieval.
     */
    registerPlugins(plugins) {
        for (const plugin of plugins) {
            this.registerPluginHook(plugin, "plugin:install");
            this.registerPluginHook(plugin, "plugin:activate");
            this.registerPluginHook(plugin, "plugin:deactivate");
            this.registerPluginHook(plugin, "plugin:uninstall");
            this.registerPluginHook(plugin, "content:beforeSave");
            this.registerPluginHook(plugin, "content:afterSave");
            this.registerPluginHook(plugin, "content:beforeDelete");
            this.registerPluginHook(plugin, "content:afterDelete");
            this.registerPluginHook(plugin, "content:beforePublish");
            this.registerPluginHook(plugin, "content:beforeSchedule");
            this.registerPluginHook(plugin, "content:beforeUnpublish");
            this.registerPluginHook(plugin, "content:afterPublish");
            this.registerPluginHook(plugin, "content:afterUnpublish");
            this.registerPluginHook(plugin, "content:afterRestore");
            this.registerPluginHook(plugin, "content:afterSchedule");
            this.registerPluginHook(plugin, "content:afterUnschedule");
            this.registerPluginHook(plugin, "media:beforeUpload");
            this.registerPluginHook(plugin, "media:afterUpload");
            this.registerPluginHook(plugin, "cron");
            this.registerPluginHook(plugin, "email:beforeSend");
            this.registerPluginHook(plugin, "email:deliver");
            this.registerPluginHook(plugin, "email:afterSend");
            this.registerPluginHook(plugin, "comment:beforeCreate");
            this.registerPluginHook(plugin, "comment:moderate");
            this.registerPluginHook(plugin, "comment:afterCreate");
            this.registerPluginHook(plugin, "comment:afterModerate");
            this.registerPluginHook(plugin, "byline:afterSave");
            this.registerPluginHook(plugin, "byline:afterDelete");
            this.registerPluginHook(plugin, "page:metadata");
            this.registerPluginHook(plugin, "page:fragments");
        }
        // Sort hooks by priority and dependencies
        for (const [hookName, hooks] of this.hooks) {
            this.hooks.set(hookName, this.sortHooks(hooks));
        }
    }
    /**
     * Maps hook names to the capability required to register them.
     *
     * Hooks not listed here have no capability requirement (e.g. lifecycle
     * hooks, cron). Any plugin declaring a listed hook without the required
     * capability will have that hook silently skipped at registration time.
     */
    static HOOK_REQUIRED_CAPABILITY = new Map([
        // Email — registering email:beforeSend/afterSend/deliver requires the
        // matching `hooks.email-*:register` capability. These are distinct
        // from `email:send` (which gates ctx.email) so that "this plugin
        // reads/writes email events" is visible separately from "this
        // plugin can send email".
        ["email:beforeSend", "hooks.email-events:register"],
        ["email:afterSend", "hooks.email-events:register"],
        ["email:deliver", "hooks.email-transport:register"],
        // Content — beforeSave can mutate content, so requires content:write.
        // afterSave is read-only notification, so content:read suffices.
        ["content:beforeSave", "content:write"],
        ["content:afterSave", "content:read"],
        ["content:beforeDelete", "content:read"],
        ["content:afterDelete", "content:read"],
        ["content:beforePublish", "hooks.content-policy:register"],
        ["content:beforeSchedule", "hooks.content-policy:register"],
        ["content:beforeUnpublish", "hooks.content-policy:register"],
        ["content:afterPublish", "content:read"],
        ["content:afterUnpublish", "content:read"],
        ["content:afterRestore", "content:read"],
        ["content:afterSchedule", "content:read"],
        ["content:afterUnschedule", "content:read"],
        // Media
        ["media:beforeUpload", "media:write"],
        ["media:afterUpload", "media:read"],
        // Comments — hooks expose author email, IP hash, user agent
        ["comment:beforeCreate", "users:read"],
        ["comment:moderate", "users:read"],
        ["comment:afterCreate", "users:read"],
        ["comment:afterModerate", "users:read"],
        ["byline:afterSave", "bylines:read"],
        ["byline:afterDelete", "bylines:read"],
        // Page fragments — can inject arbitrary scripts into every public page
        ["page:fragments", "hooks.page-fragments:register"],
    ]);
    /**
     * Register a single plugin's hook by name
     */
    registerPluginHook(plugin, name) {
        const hook = plugin.hooks[name];
        if (!hook)
            return;
        // Hooks that expose sensitive data or inject into pages require specific
        // capabilities. Plugins without the required capability have the hook
        // silently skipped to prevent unauthorized data access or page injection.
        const requiredCapability = HookPipeline.HOOK_REQUIRED_CAPABILITY.get(name);
        if (requiredCapability && !plugin.capabilities.includes(requiredCapability)) {
            console.warn(`[hooks] Plugin "${plugin.id}" declares ${name} hook without ${requiredCapability} capability — skipping`);
            return;
        }
        // Track exclusive hooks
        if (hook.exclusive) {
            this.exclusiveHookNames.add(name);
        }
        // ResolvedHook<SpecificHandler> is assignable to ResolvedHook<unknown>
        // because the handler property is covariant
        this.registerHook(name, hook);
    }
    /**
     * Register a single hook
     */
    registerHook(name, hook) {
        const existing = this.hooks.get(name) || [];
        existing.push(hook);
        this.hooks.set(name, existing);
    }
    /**
     * Sort hooks by priority and dependencies
     */
    sortHooks(hooks) {
        const sorted = [];
        const remaining = [...hooks];
        // Simple topological sort with priority as tiebreaker
        while (remaining.length > 0) {
            // Find hooks whose dependencies are satisfied
            const ready = remaining.filter((hook) => hook.dependencies.every((dep) => sorted.some((s) => s.pluginId === dep)));
            if (ready.length === 0) {
                // Circular dependency or missing dependency - log warning and fall back to priority
                const pluginIds = remaining.map((h) => h.pluginId).join(", ");
                console.warn(`[hooks] Hook dependency cycle or missing dependency detected among plugins: ${pluginIds}. Falling back to priority order.`);
                remaining.sort((a, b) => a.priority - b.priority);
                sorted.push(...remaining);
                break;
            }
            // Sort ready hooks by priority and add the first one
            ready.sort((a, b) => a.priority - b.priority);
            const next = ready[0];
            sorted.push(next);
            remaining.splice(remaining.indexOf(next), 1);
        }
        return sorted;
    }
    /**
     * Execute a hook with timeout
     */
    async executeWithTimeout(fn, timeout) {
        let timer;
        const timeoutPromise = new Promise((_, reject) => (timer = setTimeout(() => reject(new Error(`Hook timeout after ${timeout}ms`)), timeout)));
        try {
            return await Promise.race([fn(), timeoutPromise]);
        }
        finally {
            clearTimeout(timer);
        }
    }
    // =========================================================================
    // Lifecycle Hooks
    // =========================================================================
    /**
     * Run plugin:install hooks
     */
    async runPluginInstall(pluginId) {
        return this.runLifecycleHook("plugin:install", pluginId);
    }
    /**
     * Run plugin:activate hooks
     */
    async runPluginActivate(pluginId) {
        return this.runLifecycleHook("plugin:activate", pluginId);
    }
    /**
     * Run plugin:deactivate hooks
     */
    async runPluginDeactivate(pluginId) {
        return this.runLifecycleHook("plugin:deactivate", pluginId);
    }
    /**
     * Run plugin:uninstall hooks
     */
    async runPluginUninstall(pluginId, deleteData) {
        const hooks = this.getTypedHooks("plugin:uninstall");
        const results = [];
        // Only run the hook for the specific plugin being uninstalled
        const hook = hooks.find((h) => h.pluginId === pluginId);
        if (!hook)
            return results;
        const { handler } = hook;
        const event = { deleteData };
        const ctx = this.getContext(pluginId);
        const start = Date.now();
        try {
            await this.executeWithTimeout(() => handler(event, ctx), hook.timeout);
            results.push({
                success: true,
                pluginId: hook.pluginId,
                duration: Date.now() - start,
            });
        }
        catch (error) {
            results.push({
                success: false,
                error: error instanceof Error ? error : new Error(String(error)),
                pluginId: hook.pluginId,
                duration: Date.now() - start,
            });
        }
        return results;
    }
    async runLifecycleHook(hookName, pluginId) {
        const hooks = this.getTypedHooks(hookName);
        const results = [];
        // Only run the hook for the specific plugin
        const hook = hooks.find((h) => h.pluginId === pluginId);
        if (!hook)
            return results;
        const { handler } = hook;
        const event = {};
        const ctx = this.getContext(pluginId);
        const start = Date.now();
        try {
            await this.executeWithTimeout(() => handler(event, ctx), hook.timeout);
            results.push({
                success: true,
                pluginId: hook.pluginId,
                duration: Date.now() - start,
            });
        }
        catch (error) {
            results.push({
                success: false,
                error: error instanceof Error ? error : new Error(String(error)),
                pluginId: hook.pluginId,
                duration: Date.now() - start,
            });
        }
        return results;
    }
    // =========================================================================
    // Content Hooks
    // =========================================================================
    /**
     * Run content:beforeSave hooks
     * Returns modified content from the pipeline. `id` is the existing item's
     * ID when updating. `actor` is the authenticated user that triggered the
     * save, when one is available.
     */
    async runContentBeforeSave(content, collection, isNew, id, actor, details = {}) {
        const hooks = this.getTypedHooks("content:beforeSave");
        const results = [];
        let currentContent = content;
        for (const hook of hooks) {
            const { handler } = hook;
            const event = {
                content: currentContent,
                collection,
                isNew,
            };
            if (id !== undefined)
                event.id = id;
            if (actor !== undefined)
                event.actor = { ...actor };
            assignSaveHookDetails(event, details);
            const ctx = this.getContext(hook.pluginId);
            const start = Date.now();
            try {
                const result = await contentSaveHookContext.run("content:beforeSave", () => this.executeWithTimeout(() => handler(event, ctx), hook.timeout));
                // Handler can return modified content or void (keep current)
                if (result !== undefined) {
                    currentContent = result;
                }
                results.push({
                    success: true,
                    value: currentContent,
                    pluginId: hook.pluginId,
                    duration: Date.now() - start,
                });
            }
            catch (error) {
                results.push({
                    success: false,
                    error: error instanceof Error ? error : new Error(String(error)),
                    pluginId: hook.pluginId,
                    duration: Date.now() - start,
                });
                if (hook.errorPolicy === "abort") {
                    throw error;
                }
            }
        }
        return { content: currentContent, results };
    }
    /**
     * Run content:afterSave hooks
     */
    async runContentAfterSave(content, collection, isNew, actor, excludePluginId, details = {}) {
        const hooks = this.getTypedHooks("content:afterSave");
        const results = [];
        for (const hook of hooks) {
            if (hook.pluginId === excludePluginId)
                continue;
            const { handler } = hook;
            const event = { content, collection, isNew };
            if (actor !== undefined)
                event.actor = { ...actor };
            assignSaveHookDetails(event, details);
            const ctx = this.getContext(hook.pluginId);
            const start = Date.now();
            try {
                await contentSaveHookContext.run("content:afterSave", () => this.executeWithTimeout(() => handler(event, ctx), hook.timeout));
                results.push({
                    success: true,
                    pluginId: hook.pluginId,
                    duration: Date.now() - start,
                });
            }
            catch (error) {
                results.push({
                    success: false,
                    error: error instanceof Error ? error : new Error(String(error)),
                    pluginId: hook.pluginId,
                    duration: Date.now() - start,
                });
                if (hook.errorPolicy === "abort") {
                    throw error;
                }
            }
        }
        return results;
    }
    /**
     * Run content:beforeDelete hooks
     * Returns whether deletion is allowed
     */
    async runContentBeforeDelete(id, collection) {
        const hooks = this.getTypedHooks("content:beforeDelete");
        const results = [];
        let allowed = true;
        for (const hook of hooks) {
            const { handler } = hook;
            const event = { id, collection, permanent: false };
            const ctx = this.getContext(hook.pluginId);
            const start = Date.now();
            try {
                const result = await this.executeWithTimeout(() => handler(event, ctx), hook.timeout);
                // Handler returns false to block, true or void to allow
                if (result === false) {
                    allowed = false;
                }
                results.push({
                    success: true,
                    value: result !== false,
                    pluginId: hook.pluginId,
                    duration: Date.now() - start,
                });
            }
            catch (error) {
                results.push({
                    success: false,
                    error: error instanceof Error ? error : new Error(String(error)),
                    pluginId: hook.pluginId,
                    duration: Date.now() - start,
                });
                if (hook.errorPolicy === "abort") {
                    throw error;
                }
            }
        }
        return { allowed, results };
    }
    /**
     * Run content:afterDelete hooks
     */
    async runContentAfterDelete(id, collection, permanent) {
        const hooks = this.getTypedHooks("content:afterDelete");
        const results = [];
        for (const hook of hooks) {
            const { handler } = hook;
            const event = { id, collection, permanent };
            const ctx = this.getContext(hook.pluginId);
            const start = Date.now();
            try {
                await this.executeWithTimeout(() => handler(event, ctx), hook.timeout);
                results.push({
                    success: true,
                    pluginId: hook.pluginId,
                    duration: Date.now() - start,
                });
            }
            catch (error) {
                results.push({
                    success: false,
                    error: error instanceof Error ? error : new Error(String(error)),
                    pluginId: hook.pluginId,
                    duration: Date.now() - start,
                });
                if (hook.errorPolicy === "abort") {
                    throw error;
                }
            }
        }
        return results;
    }
    async runContentPolicy(name, event) {
        if (name === "content:beforeSchedule") {
            if (!("scheduledAt" in event)) {
                throw new Error("content:beforeSchedule requires scheduledAt");
            }
            return this.runContentPolicyHooks(name, this.getTypedHooks(name), event);
        }
        return this.runContentPolicyHooks(name, this.getTypedHooks(name), event);
    }
    async runContentPolicyHooks(name, hooks, event) {
        const results = [];
        for (const hook of hooks) {
            const ctx = this.getContext(hook.pluginId);
            const start = Date.now();
            try {
                const value = await this.executeWithTimeout(() => hook.handler(event, ctx), hook.timeout);
                const decision = inspectContentPolicyDecision(value);
                if (decision.kind === "invalid") {
                    throw new Error(`Plugin "${hook.pluginId}" returned an invalid ${name} decision`);
                }
                results.push({
                    success: true,
                    pluginId: hook.pluginId,
                    duration: Date.now() - start,
                });
                if (decision.kind === "cancel") {
                    return {
                        cancellation: { pluginId: hook.pluginId, reason: decision.reason },
                        results,
                    };
                }
            }
            catch (error) {
                results.push({
                    success: false,
                    error: error instanceof Error ? error : new Error(String(error)),
                    pluginId: hook.pluginId,
                    duration: Date.now() - start,
                });
                if (hook.errorPolicy === "abort")
                    throw error;
                console.error(`[content-policy] Plugin "${hook.pluginId}" failed ${name}; continuing by policy`);
            }
        }
        return { results };
    }
    /**
     * Run content state-change hooks that all share the same event shape.
     */
    async runContentStateChangeHook(name, content, collection) {
        const hooks = this.getTypedHooks(name);
        const results = [];
        for (const hook of hooks) {
            const { handler } = hook;
            const event = { content, collection };
            const ctx = this.getContext(hook.pluginId);
            const start = Date.now();
            try {
                await this.executeWithTimeout(() => handler(event, ctx), hook.timeout);
                results.push({
                    success: true,
                    pluginId: hook.pluginId,
                    duration: Date.now() - start,
                });
            }
            catch (error) {
                results.push({
                    success: false,
                    error: error instanceof Error ? error : new Error(String(error)),
                    pluginId: hook.pluginId,
                    duration: Date.now() - start,
                });
                if (hook.errorPolicy === "abort") {
                    throw error;
                }
            }
        }
        return results;
    }
    /**
     * Run content:afterPublish hooks (fire-and-forget).
     */
    async runContentAfterPublish(content, collection) {
        return this.runContentStateChangeHook("content:afterPublish", content, collection);
    }
    /**
     * Run content:afterUnpublish hooks (fire-and-forget).
     */
    async runContentAfterUnpublish(content, collection) {
        return this.runContentStateChangeHook("content:afterUnpublish", content, collection);
    }
    /**
     * Run content:afterRestore hooks (fire-and-forget).
     */
    async runContentAfterRestore(content, collection) {
        return this.runContentStateChangeHook("content:afterRestore", content, collection);
    }
    /**
     * Run content:afterSchedule hooks (fire-and-forget).
     */
    async runContentAfterSchedule(content, collection) {
        return this.runContentStateChangeHook("content:afterSchedule", content, collection);
    }
    /**
     * Run content:afterUnschedule hooks (fire-and-forget).
     */
    async runContentAfterUnschedule(content, collection) {
        return this.runContentStateChangeHook("content:afterUnschedule", content, collection);
    }
    // =========================================================================
    // Media Hooks
    // =========================================================================
    /**
     * Run media:beforeUpload hooks
     */
    async runMediaBeforeUpload(file) {
        const hooks = this.getTypedHooks("media:beforeUpload");
        const results = [];
        let currentFile = file;
        for (const hook of hooks) {
            const { handler } = hook;
            const event = { file: currentFile };
            const ctx = this.getContext(hook.pluginId);
            const start = Date.now();
            try {
                const result = await this.executeWithTimeout(() => handler(event, ctx), hook.timeout);
                // Handler can return modified file info or void
                if (result !== undefined) {
                    currentFile = result;
                }
                results.push({
                    success: true,
                    value: currentFile,
                    pluginId: hook.pluginId,
                    duration: Date.now() - start,
                });
            }
            catch (error) {
                results.push({
                    success: false,
                    error: error instanceof Error ? error : new Error(String(error)),
                    pluginId: hook.pluginId,
                    duration: Date.now() - start,
                });
                if (hook.errorPolicy === "abort") {
                    throw error;
                }
            }
        }
        return { file: currentFile, results };
    }
    /**
     * Run media:afterUpload hooks
     */
    async runMediaAfterUpload(media) {
        const hooks = this.getTypedHooks("media:afterUpload");
        const results = [];
        for (const hook of hooks) {
            const { handler } = hook;
            const event = { media };
            const ctx = this.getContext(hook.pluginId);
            const start = Date.now();
            try {
                await this.executeWithTimeout(() => handler(event, ctx), hook.timeout);
                results.push({
                    success: true,
                    pluginId: hook.pluginId,
                    duration: Date.now() - start,
                });
            }
            catch (error) {
                results.push({
                    success: false,
                    error: error instanceof Error ? error : new Error(String(error)),
                    pluginId: hook.pluginId,
                    duration: Date.now() - start,
                });
                if (hook.errorPolicy === "abort") {
                    throw error;
                }
            }
        }
        return results;
    }
    // =========================================================================
    // Cron Hook (per-plugin dispatch)
    // =========================================================================
    /**
     * Invoke the cron hook for a specific plugin.
     *
     * Unlike other hooks which broadcast to all plugins, the cron hook is
     * dispatched only to the target plugin — the one that owns the task.
     */
    async invokeCronHook(pluginId, event) {
        const hooks = this.getTypedHooks("cron");
        const hook = hooks.find((h) => h.pluginId === pluginId);
        if (!hook) {
            return {
                success: false,
                error: new Error(`Plugin "${pluginId}" has no cron hook registered`),
                pluginId,
                duration: 0,
            };
        }
        const { handler } = hook;
        const ctx = this.getContext(pluginId);
        const start = Date.now();
        try {
            await this.executeWithTimeout(() => handler(event, ctx), hook.timeout);
            return {
                success: true,
                pluginId,
                duration: Date.now() - start,
            };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error : new Error(String(error)),
                pluginId,
                duration: Date.now() - start,
            };
        }
    }
    // =========================================================================
    // Email Hooks
    // =========================================================================
    /**
     * Run email:beforeSend hooks (middleware pipeline).
     *
     * Each handler receives the message and returns a modified message or
     * `false` to cancel delivery. The pipeline chains message transformations —
     * each handler receives the output of the previous one.
     */
    async runEmailBeforeSend(message, source) {
        const hooks = this.getTypedHooks("email:beforeSend");
        const results = [];
        let currentMessage = message;
        for (const hook of hooks) {
            const { handler } = hook;
            // Shallow-clone message to prevent handlers from mutating
            // the shared reference and leaking changes to subsequent stages
            const event = { message: { ...currentMessage }, source };
            const ctx = this.getContext(hook.pluginId);
            const start = Date.now();
            try {
                const result = await this.executeWithTimeout(() => handler(event, ctx), hook.timeout);
                if (result === false) {
                    // Cancelled
                    results.push({
                        success: true,
                        value: false,
                        pluginId: hook.pluginId,
                        duration: Date.now() - start,
                    });
                    return { message: false, results };
                }
                // Handler returned a modified message
                if (result && typeof result === "object") {
                    currentMessage = result;
                }
                results.push({
                    success: true,
                    value: currentMessage,
                    pluginId: hook.pluginId,
                    duration: Date.now() - start,
                });
            }
            catch (error) {
                results.push({
                    success: false,
                    error: error instanceof Error ? error : new Error(String(error)),
                    pluginId: hook.pluginId,
                    duration: Date.now() - start,
                });
                if (hook.errorPolicy === "abort") {
                    throw error;
                }
            }
        }
        return { message: currentMessage, results };
    }
    /**
     * Run email:afterSend hooks (fire-and-forget).
     *
     * Errors are logged but don't propagate — they don't affect the caller.
     */
    async runEmailAfterSend(message, source) {
        const hooks = this.getTypedHooks("email:afterSend");
        const results = [];
        for (const hook of hooks) {
            const { handler } = hook;
            const event = { message, source };
            const ctx = this.getContext(hook.pluginId);
            const start = Date.now();
            try {
                await this.executeWithTimeout(() => handler(event, ctx), hook.timeout);
                results.push({
                    success: true,
                    pluginId: hook.pluginId,
                    duration: Date.now() - start,
                });
            }
            catch (error) {
                // Fire-and-forget: log but don't propagate
                console.error(`[email:afterSend] Plugin "${hook.pluginId}" error:`, error instanceof Error ? error.message : error);
                results.push({
                    success: false,
                    error: error instanceof Error ? error : new Error(String(error)),
                    pluginId: hook.pluginId,
                    duration: Date.now() - start,
                });
            }
        }
        return results;
    }
    // =========================================================================
    // Comment Hooks
    // =========================================================================
    /**
     * Run comment:beforeCreate hooks (middleware pipeline).
     *
     * Each handler receives the event and returns a modified event or
     * `false` to reject the comment. The pipeline chains transformations —
     * each handler receives the output of the previous one.
     */
    async runCommentBeforeCreate(event) {
        const hooks = this.getTypedHooks("comment:beforeCreate");
        let currentEvent = event;
        for (const hook of hooks) {
            const { handler } = hook;
            const ctx = this.getContext(hook.pluginId);
            const start = Date.now();
            try {
                const result = await this.executeWithTimeout(() => handler({ ...currentEvent }, ctx), hook.timeout);
                if (result === false) {
                    return false;
                }
                if (result && typeof result === "object") {
                    currentEvent = result;
                }
            }
            catch (error) {
                console.error(`[comment:beforeCreate] Plugin "${hook.pluginId}" error (${Date.now() - start}ms):`, error instanceof Error ? error.message : error);
                if (hook.errorPolicy === "abort") {
                    throw error;
                }
            }
        }
        return currentEvent;
    }
    /**
     * Run comment:afterCreate hooks (fire-and-forget).
     *
     * Errors are logged but don't propagate — they don't affect the caller.
     */
    async runCommentAfterCreate(event) {
        const hooks = this.getTypedHooks("comment:afterCreate");
        for (const hook of hooks) {
            const { handler } = hook;
            const ctx = this.getContext(hook.pluginId);
            try {
                await this.executeWithTimeout(() => handler(event, ctx), hook.timeout);
            }
            catch (error) {
                console.error(`[comment:afterCreate] Plugin "${hook.pluginId}" error:`, error instanceof Error ? error.message : error);
            }
        }
    }
    /**
     * Run comment:afterModerate hooks (fire-and-forget).
     *
     * Errors are logged but don't propagate — they don't affect the caller.
     */
    async runCommentAfterModerate(event) {
        const hooks = this.getTypedHooks("comment:afterModerate");
        for (const hook of hooks) {
            const { handler } = hook;
            const ctx = this.getContext(hook.pluginId);
            try {
                await this.executeWithTimeout(() => handler(event, ctx), hook.timeout);
            }
            catch (error) {
                console.error(`[comment:afterModerate] Plugin "${hook.pluginId}" error:`, error instanceof Error ? error.message : error);
            }
        }
    }
    // =========================================================================
    // Byline Hooks
    // =========================================================================
    /** Run byline:afterSave hooks. Errors are logged and never propagate. */
    async runBylineAfterSave(byline, isNew) {
        const event = { byline: toBylineInfo(byline), isNew };
        for (const hook of this.getTypedHooks("byline:afterSave")) {
            await this.runLoggedHook("byline:afterSave", hook, (ctx) => hook.handler(event, ctx));
        }
    }
    /** Run byline:afterDelete hooks. Errors are logged and never propagate. */
    async runBylineAfterDelete(byline) {
        const event = { byline: toBylineInfo(byline) };
        for (const hook of this.getTypedHooks("byline:afterDelete")) {
            await this.runLoggedHook("byline:afterDelete", hook, (ctx) => hook.handler(event, ctx));
        }
    }
    async runLoggedHook(name, hook, run) {
        try {
            await this.executeWithTimeout(() => run(this.getContext(hook.pluginId)), hook.timeout);
        }
        catch (error) {
            console.error(`[${name}] Plugin "${hook.pluginId}" error:`, error instanceof Error ? error.message : error);
        }
    }
    // =========================================================================
    // Public Page Hooks
    // =========================================================================
    /**
     * Run page:metadata hooks. Each handler returns contributions that are
     * merged by the metadata collector. Errors are logged but don't propagate.
     */
    async runPageMetadata(event) {
        const hooks = this.getTypedHooks("page:metadata");
        const results = [];
        for (const hook of hooks) {
            const { handler } = hook;
            const ctx = this.getContext(hook.pluginId);
            try {
                const result = await this.executeWithTimeout(() => Promise.resolve(handler(event, ctx)), hook.timeout);
                if (result != null) {
                    const contributions = Array.isArray(result) ? result : [result];
                    results.push({ pluginId: hook.pluginId, contributions });
                }
            }
            catch (error) {
                console.error(`[page:metadata] Plugin "${hook.pluginId}" error:`, error instanceof Error ? error.message : error);
            }
        }
        return results;
    }
    /**
     * Run page:fragments hooks. Only trusted plugins should be registered
     * for this hook. Errors are logged but don't propagate.
     */
    async runPageFragments(event) {
        const hooks = this.getTypedHooks("page:fragments");
        const results = [];
        for (const hook of hooks) {
            const { handler } = hook;
            const ctx = this.getContext(hook.pluginId);
            try {
                const result = await this.executeWithTimeout(() => Promise.resolve(handler(event, ctx)), hook.timeout);
                if (result != null) {
                    const contributions = Array.isArray(result) ? result : [result];
                    results.push({ pluginId: hook.pluginId, contributions });
                }
            }
            catch (error) {
                console.error(`[page:fragments] Plugin "${hook.pluginId}" error:`, error instanceof Error ? error.message : error);
            }
        }
        return results;
    }
    // =========================================================================
    // Utilities
    // =========================================================================
    /**
     * Check if any hooks are registered for a given name
     */
    hasHooks(name) {
        const hooks = this.hooks.get(name);
        return hooks !== undefined && hooks.length > 0;
    }
    /**
     * Get hook count for debugging
     */
    getHookCount(name) {
        return this.hooks.get(name)?.length || 0;
    }
    /**
     * Get all registered hook names
     */
    getRegisteredHooks() {
        return [...this.hooks.keys()];
    }
    // =========================================================================
    // Exclusive Hook Support
    // =========================================================================
    /**
     * Returns hook names where at least one handler declared exclusive: true
     */
    getRegisteredExclusiveHooks() {
        return [...this.exclusiveHookNames];
    }
    /**
     * Check if a hook is exclusive
     */
    isExclusiveHook(name) {
        return this.exclusiveHookNames.has(name);
    }
    /**
     * Set the selected provider for an exclusive hook.
     * Called by PluginManager after resolution.
     */
    setExclusiveSelection(hookName, pluginId) {
        this.exclusiveSelections.set(hookName, pluginId);
    }
    /**
     * Clear the selected provider for an exclusive hook.
     */
    clearExclusiveSelection(hookName) {
        this.exclusiveSelections.delete(hookName);
    }
    /**
     * Get the selected provider for an exclusive hook (if any).
     */
    getExclusiveSelection(hookName) {
        return this.exclusiveSelections.get(hookName);
    }
    /**
     * Get all plugins that registered a handler for a given exclusive hook.
     */
    getExclusiveHookProviders(hookName) {
        const hooks = this.hooks.get(hookName) ?? [];
        return hooks.filter((h) => h.exclusive).map((h) => ({ pluginId: h.pluginId }));
    }
    /**
     * Get all plugins that registered a non-exclusive handler for a given
     * hook (e.g. `email:beforeSend`, `email:afterSend`), preserving priority
     * order. Partitions with `getExclusiveHookProviders()`, which returns
     * plugins whose registration is marked `exclusive: true`.
     */
    getHookProviders(hookName) {
        const hooks = this.hooks.get(hookName) ?? [];
        return hooks.filter((h) => !h.exclusive).map((h) => ({ pluginId: h.pluginId }));
    }
    /**
     * Invoke an exclusive hook — dispatch only to the selected provider.
     * Returns null if no provider is selected or if the selected hook
     * is not found in the pipeline.
     *
     * This is a generic dispatch used by the email pipeline and other
     * exclusive hook consumers. The handler type is unknown — callers
     * must know the expected signature.
     *
     * Errors are isolated: a failing handler returns an error result
     * instead of propagating the exception to the caller.
     */
    async invokeExclusiveHook(hookName, event) {
        const selectedPluginId = this.exclusiveSelections.get(hookName);
        if (!selectedPluginId)
            return null;
        const hooks = this.hooks.get(hookName) ?? [];
        const hook = hooks.find((h) => h.pluginId === selectedPluginId && h.exclusive);
        if (!hook)
            return null;
        const start = Date.now();
        try {
            const ctx = this.getContext(selectedPluginId);
            const handler = hook.handler;
            const result = await this.executeWithTimeout(() => handler(event, ctx), hook.timeout);
            return { result, pluginId: selectedPluginId, duration: Date.now() - start };
        }
        catch (error) {
            return {
                result: undefined,
                pluginId: selectedPluginId,
                error: error instanceof Error ? error : new Error(String(error)),
                duration: Date.now() - start,
            };
        }
    }
}
/**
 * Create a hook pipeline from plugins
 */
export function createHookPipeline(plugins, factoryOptions) {
    return new HookPipeline(plugins, factoryOptions);
}
/** Options table key prefix for exclusive hook selections */
const EXCLUSIVE_HOOK_KEY_PREFIX = "emdash:exclusive_hook:";
/**
 * Resolve exclusive hook selections.
 *
 * Shared algorithm used by both PluginManager and EmDashRuntime:
 * 1. If a DB selection exists and that plugin is active → keep it.
 * 2. If DB selection is stale (plugin inactive/gone) → clear it.
 * 3. If no selection and only one active provider → auto-select it. Fallback
 *    providers are not counted when another provider is active, so a single
 *    plugin provider is selected over a built-in fallback. A fallback
 *    selection is kept in memory only.
 * 4. If preferred hints match an active provider → first match wins.
 * 5. If multiple providers and no hint → leave unselected (admin must choose).
 */
export async function resolveExclusiveHooks(opts) {
    const { pipeline, isActive, getOption, getOptions, setOption, deleteOption, preferredHints, fallbackProviders, } = opts;
    const exclusiveHookNames = pipeline.getRegisteredExclusiveHooks();
    if (exclusiveHookNames.length === 0)
        return;
    // Batch-read current selections in one round trip when the caller
    // provides a batch reader (1 query instead of N sequential gets).
    let batchedSelections;
    if (getOptions) {
        try {
            batchedSelections = await getOptions(exclusiveHookNames.map((hookName) => `${EXCLUSIVE_HOOK_KEY_PREFIX}${hookName}`));
        }
        catch {
            // Options table may not be ready. Matches the per-key tolerance
            // below: every hook's read would fail, so resolution is skipped
            // entirely without touching any selection.
            return;
        }
    }
    for (const hookName of exclusiveHookNames) {
        const providers = pipeline.getExclusiveHookProviders(hookName);
        const activeProviderIds = new Set(providers.map((p) => p.pluginId).filter((id) => isActive(id)));
        const key = `${EXCLUSIVE_HOOK_KEY_PREFIX}${hookName}`;
        let currentSelection = null;
        if (batchedSelections) {
            currentSelection = batchedSelections.get(key) ?? null;
        }
        else {
            try {
                currentSelection = await getOption(key);
            }
            catch {
                // Options table may not be ready
                continue;
            }
        }
        // If selection exists and the plugin is still active → keep it
        if (currentSelection && activeProviderIds.has(currentSelection)) {
            pipeline.setExclusiveSelection(hookName, currentSelection);
            continue;
        }
        // Selection is stale or missing — clear it
        if (currentSelection) {
            try {
                await deleteOption(key);
            }
            catch {
                // Non-fatal
            }
        }
        // Auto-select if only one active provider
        const candidates = activeProviderIds.size > 1 && fallbackProviders
            ? [...activeProviderIds].filter((id) => !fallbackProviders.has(id))
            : [...activeProviderIds];
        if (candidates.length === 1) {
            const [onlyProvider] = candidates;
            if (!fallbackProviders?.has(onlyProvider)) {
                try {
                    await setOption(key, onlyProvider);
                }
                catch {
                    // Non-fatal
                }
            }
            pipeline.setExclusiveSelection(hookName, onlyProvider);
            continue;
        }
        // Check preferred hints
        if (preferredHints) {
            let found = false;
            for (const [pluginId, hooks] of preferredHints) {
                if (hooks.includes(hookName) && activeProviderIds.has(pluginId)) {
                    try {
                        await setOption(key, pluginId);
                    }
                    catch {
                        // Non-fatal
                    }
                    pipeline.setExclusiveSelection(hookName, pluginId);
                    found = true;
                    break;
                }
            }
            if (found)
                continue;
        }
        // Multiple providers, no hint — leave unselected
        pipeline.clearExclusiveSelection(hookName);
    }
}
