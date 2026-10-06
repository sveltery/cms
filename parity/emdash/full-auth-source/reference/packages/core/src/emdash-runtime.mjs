/**
 * EmDashRuntime - Core runtime for EmDash CMS
 *
 * Manages database, storage, plugins (trusted + sandboxed), hooks, and
 * provides handlers for content/media operations.
 *
 * Created once per worker lifetime, cached and reused across requests.
 */
import { getLocaleDir, resolveLocale } from "@emdash-cms/admin/locales";
import { Permissions } from "@emdash-cms/auth";
import { normalizePluginPagePath, validateBlockResponse, validateContentEditorActionResponse, } from "@emdash-cms/blocks/server";
import { isJsonPostRouteContract } from "@emdash-cms/plugin-types";
import { Kysely } from "kysely";
import virtualConfig from "virtual:emdash/config";
import { z } from "zod";
import { ErrorCode } from "./api/errors.js";
import { buildManifestCollections } from "./api/handlers/manifest.js";
import { handleMediaUpload as uploadMedia, } from "./api/handlers/media-upload.js";
import { resolveReferenceSelection } from "./api/handlers/relations.js";
import { liveReferenceSelection, mergeStagedReferenceBaselines, mergeStagedReferences, STAGED_REFERENCES_BASELINE_KEY, STAGED_REFERENCES_KEY, } from "./api/handlers/staged-references.js";
import { validateRev } from "./api/rev.js";
import { getSiteBaseUrl } from "./api/site-url.js";
import { getAuthMode } from "./auth/mode.js";
import { getTrustedProxyHeaders } from "./auth/trusted-proxy.js";
import { lookupContentAuthor, sendCommentNotification } from "./comments/notifications.js";
import { keepKnownFields, staleStoredKeys } from "./content/known-fields.js";
import { isSqlite } from "./database/dialect-helpers.js";
import { kyselyLogOption } from "./database/instrumentation.js";
import { enforceRuntimeMigrationPolicy, PendingMigrationsError, } from "./database/migrations/policy.js";
import { ConcurrentMigrationTimeoutError, MIGRATION_RACE_WAIT_MS, } from "./database/migrations/runner.js";
import { AuditRepository } from "./database/repositories/audit.js";
import { CommentRepository } from "./database/repositories/comment.js";
import { ContentRepository } from "./database/repositories/content.js";
import { RevisionRepository } from "./database/repositories/revision.js";
import { selectTaxonomyDefs } from "./database/repositories/taxonomy-def.js";
import { ContentMutationConflictError } from "./database/repositories/types.js";
import { getI18nConfig, resolveContentCreateLocale } from "./i18n/config.js";
import { repairLocaleCasing } from "./i18n/repair-locale-casing.js";
import { warnAboutUnconfiguredTaxonomyLocales } from "./i18n/taxonomy-locale-diagnostic.js";
import { normalizeMediaValue } from "./media/normalize.js";
import { activateMediaUsageCapture } from "./media/usage/activation.js";
import { deleteContentMediaUsage, findNonTranslatableSiblingContentIds, markContentMediaUsageCollectionStale, refreshContentMediaUsageAfterWrite, } from "./media/usage/content-refresh.js";
import { processMediaUsageWorkAfterWrite } from "./media/usage/work-processor.js";
import { scheduledPolicyRejectionKey, } from "./plugins/content-policy.js";
import { createCommentAccess, createTaxonomyAccessWithWrite } from "./plugins/context.js";
import { createSandboxedPluginProxy, getSandboxSaveRejectionDetails, } from "./plugins/sandbox/proxy.js";
import { createSandboxRunnerOptions } from "./plugins/sandbox/runner-options.js";
import { getSandboxRouteErrorDetails } from "./plugins/sandbox/types.js";
import { normalizePluginCapabilities, warnDeprecatedPluginCapabilities } from "./plugins/types.js";
import { recordSchedulerHeartbeatSafely } from "./scheduler-health.js";
import { primeRegisteredCollections } from "./schema/collection-slugs-cache.js";
import { isStoragelessField, isStoragelessFieldRow } from "./schema/types.js";
import { AUTO_SEED_COMPLETE_OPTION } from "./seed/ownership.js";
import { isMissingTableError } from "./utils/db-errors.js";
import { hashString } from "./utils/hash.js";
import { createInitLock, initWithLock } from "./utils/init-lock.js";
import { createSingleFlightCache, singleFlightCached } from "./utils/single-flight-cache.js";
import { COMMIT, VERSION } from "./version.js";
const LEADING_SLASH_PATTERN = /^\//;
const LOCALE_CASING_REPAIR_OPTION = "emdash:repair_locale_casing";
const SETUP_COMPLETE_OPTION = "emdash:setup_complete";
const PLUGIN_COMMENT_STATUSES = new Set(["approved", "pending", "spam"]);
function assertPluginCommentStatus(value, name) {
    if (!PLUGIN_COMMENT_STATUSES.has(value)) {
        throw Object.assign(new Error(`${name} must be one of: approved, pending, spam`), {
            code: "COMMENT_STATUS_INVALID",
        });
    }
}
function getLocaleCasingRepairVersion(locales) {
    if (locales.length === 0)
        return null;
    return `1:${locales.toSorted().join(",")}`;
}
/**
 * Parse a JSON column expected to contain an array of strings.
 *
 * Throws on malformed JSON rather than returning []; callers are responsible
 * for deciding how to handle/log the error. Empty string / null inputs return
 * [] (they represent "no value"). Non-string array entries are filtered out.
 */
function parseStringArray(raw) {
    if (!raw)
        return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed))
        return [];
    return parsed.filter((v) => typeof v === "string");
}
function isModerationDecision(value) {
    if (typeof value !== "object" || value === null || !("status" in value))
        return false;
    if (value.status !== "pending" && value.status !== "approved" && value.status !== "spam") {
        return false;
    }
    return !("reason" in value) || value.reason === undefined || typeof value.reason === "string";
}
import { after } from "./after.js";
import { maybeRunScheduledBackup } from "./api/handlers/backup.js";
import { changedStoragelessDataKeys, storagelessDataKeyError } from "./api/handlers/content.js";
import { loadBundleFromR2 } from "./api/handlers/marketplace.js";
import { runSystemCleanup } from "./cleanup.js";
import { DEFAULT_COMMENT_MODERATOR_PLUGIN_ID, defaultCommentModerate, } from "./comments/moderator.js";
import { submitPublicComment } from "./comments/public-submission.js";
import { CommentStatusConflictError, createComment, moderateComment, } from "./comments/service.js";
import { validateEncryptionKeyAtStartup } from "./config/secrets.js";
import { OptionsRepository } from "./database/repositories/options.js";
import { handleContentList, handleContentAuthors, handleContentGet, handleContentGetIncludingTrashed, handleContentCreate, handleContentUpdate, handleContentDelete, handleContentDuplicate, handleContentRestore, handleContentPermanentDelete, handleContentListTrashed, handleContentCountTrashed, handleContentPublish, handleContentUnpublish, handleContentSchedule, handleContentUnschedule, handleScheduledPolicyRejection, handleContentCountScheduled, handleContentDiscardDraft, handleContentCompare, handleContentTranslations, handleMediaList, handleMediaGet, handleMediaCreate, handleMediaRegisterUpload, handleMediaUpdate, handleMediaReplaceMetadata, handleMediaDelete, handleRevisionList, handleRevisionGet, handleRevisionRestore, SchemaRegistry, SchemaError, normalizeBlocksData, resolveBlockTypes, } from "./index.js";
import { getDb } from "./loader.js";
import { isRecord } from "./plugin-utils.js";
import { CronExecutor } from "./plugins/cron.js";
import { definePlugin } from "./plugins/define-plugin.js";
import { DEV_CONSOLE_EMAIL_PLUGIN_ID, devConsoleEmailDeliver } from "./plugins/email-console.js";
import { EmailPipeline } from "./plugins/email.js";
import { createHookPipeline, getActiveContentSaveHookName, resolveExclusiveHooks as resolveExclusiveHooksShared, } from "./plugins/hooks.js";
import { disableRuntimePlugin, enableRuntimePlugin } from "./plugins/lifecycle.js";
import { HOOK_NAMES, normalizeManifestRoute } from "./plugins/manifest-schema.js";
import { updatePluginMediaMetadata } from "./plugins/media.js";
import { extractRequestMeta, sanitizeHeadersForSandbox } from "./plugins/request-meta.js";
import { PluginRouteRequestError } from "./plugins/route-wire.js";
import { buildRouteMeta, parseRouteInput, PluginRouteRegistry, toRouteCallerInfo, } from "./plugins/routes.js";
import { isContentSaveRejection } from "./plugins/save-rejection.js";
import { PluginStateRepository } from "./plugins/state.js";
import { syncDeclaredStorageIndexes } from "./plugins/storage-indexes.js";
import { getRegistryConfigInput, resolveManifestRegistryConfig } from "./registry/config.js";
import { requestCached } from "./request-cache.js";
import { getRequestContext } from "./request-context.js";
import { publishDueContent } from "./scheduled-publish.js";
import { FTSManager } from "./search/fts-manager.js";
import { invalidateSiteSettingsCache } from "./settings/index.js";
import { assertSiteWriteAllowed } from "./transfer/fence.js";
const DRAFT_ONLY_UPDATE_KEYS = new Set([
    "data",
    "slug",
    "locale",
    "skipRevision",
    "references",
    "actor",
    "migrateBlocks",
    "replaceBlocks",
]);
/** Field types whose schema is an array, so a stored blank string can never validate. */
const ARRAY_FIELD_TYPES = new Set(["portableText", "multiSelect", "repeater"]);
const MAX_DRAFT_STAGE_ATTEMPTS = 32;
const PLUGIN_INVOCATION_RELEASE_GRACE_MS = 60_000;
/**
 * A `ContentSaveRejectedError` carries a message the plugin wrote for the
 * editor; every other exception stays internal and is replaced by a generic
 * message so hook internals cannot leak through the API.
 */
function beforeSaveFailure(error) {
    if (isContentSaveRejection(error)) {
        const sandbox = getSandboxSaveRejectionDetails(error);
        if (sandbox) {
            return {
                success: false,
                error: {
                    code: ErrorCode.SAVE_REJECTED,
                    message: error.message,
                    details: sandbox,
                },
            };
        }
        return {
            success: false,
            error: { code: ErrorCode.SAVE_REJECTED, message: error.message },
        };
    }
    console.error("EmDash: content:beforeSave hook failed:", error);
    return {
        success: false,
        error: {
            code: ErrorCode.CONTENT_HOOK_ERROR,
            message: "A plugin hook failed while saving content",
        },
    };
}
/**
 * Convert a ContentItem to Record<string, unknown> for hook consumption.
 * Hooks receive the full item as a flat record.
 */
function contentItemToRecord(item) {
    return { ...item };
}
function toPluginContentItem(item) {
    return {
        id: item.id,
        type: item.type,
        slug: item.slug,
        status: item.status,
        locale: item.locale,
        data: item.data,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        publishedAt: item.publishedAt,
        scheduledAt: item.scheduledAt,
        authorId: item.authorId,
        translationGroup: item.translationGroup,
        liveRevisionId: item.liveRevisionId,
        draftRevisionId: item.draftRevisionId,
        version: item.version,
        ...(item.seo === undefined ? {} : { seo: item.seo }),
    };
}
/**
 * Db init lock reclaim deadline. Derived from the migration race wait so
 * they can't drift apart: a healthy init can legitimately block for the
 * full MIGRATION_RACE_WAIT_MS inside waitForConcurrentMigrator, plus cold
 * connect and migrator work, before it should be presumed dead. The outer
 * runtime init lock (middleware.ts) must use a strictly larger deadline —
 * it wraps create() → getDatabase() → this lock, and equal deadlines would
 * let the outer reclaim while the inner is legitimately still working.
 */
export const DB_INIT_DEADLINE_MS = MIGRATION_RACE_WAIT_MS + 20_000;
/**
 * Db cache + its init lock live on globalThis behind a Symbol: the bundler
 * can duplicate this module across SSR chunks (same reasoning as
 * request-cache.ts), and a duplicated cache/lock would mean concurrent
 * independent db inits — and duplicate migrators — per isolate.
 */
const DB_HOLDER_KEY = Symbol.for("emdash:db-cache");
const globalSymbolStore = globalThis;
function getDbHolder() {
    // eslint-disable-next-line typescript/no-unsafe-type-assertion -- globalThis symbol slot, written only below
    let holder = globalSymbolStore[DB_HOLDER_KEY];
    if (!holder) {
        holder = {
            cache: new Map(),
            lock: createInitLock(),
            failures: new Map(),
        };
        globalSymbolStore[DB_HOLDER_KEY] = holder;
    }
    // A holder created by an older copy of this module (dev-server HMR keeps
    // globalThis across reloads) may predate the failures map.
    holder.failures ??= new Map();
    return holder;
}
/**
 * After a database init fails (migrations threw), skip re-attempting for
 * this long. Cold isolates still get one attempt each, so a transient
 * failure heals on its own; a persistently failing migration is retried at
 * most once per backoff window per isolate instead of on every request.
 */
const DB_INIT_FAILURE_BACKOFF_MS = 30_000;
/**
 * Auto-seed runs at most once per isolate per database. Its lock + "done" set
 * live on globalThis (same bundler-duplication reasoning as the db cache) so a
 * reclaimed-and-rerun `create()` can't seed a second time concurrently. The
 * lock polls rather than sharing a promise, so it is safe to await across a
 * cancelled owner in workerd.
 */
const SEED_HOLDER_KEY = Symbol.for("emdash:seed-state");
function getSeedHolder() {
    // eslint-disable-next-line typescript/no-unsafe-type-assertion -- globalThis symbol slot, written only below
    let holder = globalSymbolStore[SEED_HOLDER_KEY];
    if (!holder) {
        holder = { done: new Set(), lock: createInitLock() };
        globalSymbolStore[SEED_HOLDER_KEY] = holder;
    }
    return holder;
}
const storageCache = new Map();
const sandboxedPluginCache = new Map();
const sandboxedManifestCache = new Map();
/**
 * Per-tier sets of `${pluginId}:${version}` keys present in
 * `sandboxedPluginCache`. Used during sync to know which entries belong
 * to which install source so we can invalidate only what belongs to the
 * tier currently being synced.
 */
const marketplacePluginKeys = new Set();
const registryPluginKeys = new Set();
/**
 * Manifest metadata for runtime-installed sandboxed plugins (marketplace
 * and registry both). Keyed by `pluginId`; readers don't care which
 * source the plugin came from. Named `marketplace*` for legacy reasons.
 */
const marketplaceManifestCache = new Map();
/** Route metadata for sandboxed plugins: pluginId -> routeName -> RouteMeta */
const sandboxedRouteMetaCache = new Map();
let sandboxRunner = null;
function allowedBrowserImageHosts(capabilities, allowedHosts) {
    if (capabilities.includes("network:request:unrestricted") ||
        capabilities.includes("network:fetch:any")) {
        return ["*"];
    }
    if (capabilities.includes("network:request") || capabilities.includes("network:fetch")) {
        return allowedHosts;
    }
    return [];
}
/**
 * EmDashRuntime - singleton per worker
 */
export class EmDashRuntime {
    /**
     * The singleton database instance (worker-lifetime cached).
     * Use the `db` getter instead — it checks the request context first
     * for per-request overrides (D1 read replica sessions, DO multi-site).
     */
    _db;
    storage;
    configuredPlugins;
    sandboxedPlugins;
    sandboxedPluginEntries;
    /**
     * Schema registry bound to the current request/event-scoped connection.
     * Built per access (SchemaRegistry just wraps a db) against `this.db`, the
     * ALS-aware getter — never a captured snapshot of the singleton. On a
     * connection-backed adapter (Postgres over Hyperdrive) a captured singleton
     * would query a socket opened by an earlier event and trip workerd's
     * cross-request I/O guard; the catch in handlers like handleContentUpdate
     * would then silently treat a revision-enabled collection as non-revisioned
     * and write draft edits to live columns. Same reasoning as the per-call
     * registry in _buildManifest().
     */
    get schemaRegistry() {
        return new SchemaRegistry(this.db);
    }
    _hooks;
    config;
    mediaProviders;
    mediaProviderEntries;
    cronExecutor;
    email;
    cronScheduler;
    enabledPlugins;
    pluginStates;
    activePluginContentActions = new Map();
    pendingPluginAfterHooks = new Map();
    activePluginInvocations = new Set();
    /** Timed-out sandbox invocations whose later actions must schedule hooks without another flush. */
    releasedPluginInvocations = new Set();
    pluginInvocationCacheInvalidators = new Map();
    pluginContentCacheInvalidator;
    /**
     * Isolate-lifetime guard so FTS indexes are verified at most once per
     * worker rather than on every admin request. See ensureSearchHealthy().
     * Uses the poison-immune single-flight cache (never a shared awaitable
     * promise) so a cancelled first caller can't wedge later ones.
     */
    _searchHealthCache = createSingleFlightCache();
    /** Current hook pipeline. Use the `hooks` getter for external access. */
    get hooks() {
        return this._hooks;
    }
    /** All plugins eligible for the hook pipeline (includes built-in plugins).
     *  Stored so we can rebuild the pipeline when plugins are enabled/disabled. */
    allPipelinePlugins;
    /** Guards the once-per-process plugin storage-index sync. */
    storageIndexesSynced = false;
    /** Factory options for the hook pipeline context factory */
    pipelineFactoryOptions;
    /** Dependencies needed for exclusive hook resolution */
    runtimeDeps;
    /** Mutable ref for the cron invokeCronHook closure to read the current pipeline */
    pipelineRef;
    commentModerationInProgress = new Set();
    /**
     * Get the database instance for the current request.
     *
     * Checks the ALS-based request context first — middleware sets a
     * per-request Kysely instance there for D1 read replica sessions
     * or DO preview databases. Falls back to the singleton instance.
     */
    get db() {
        const ctx = getRequestContext();
        if (ctx?.db) {
            // eslint-disable-next-line typescript/no-unsafe-type-assertion -- db in context is set by middleware with correct type
            return ctx.db;
        }
        return this._db;
    }
    /** Bind the platform cache provider used by plugin actions, including request-less cron hooks. */
    setPluginContentCacheInvalidator(invalidateContentCache) {
        this.pluginContentCacheInvalidator = invalidateContentCache;
    }
    constructor(parts) {
        this._db = parts.db;
        this.storage = parts.storage;
        this.configuredPlugins = parts.configuredPlugins;
        this.sandboxedPlugins = parts.sandboxedPlugins;
        this.sandboxedPluginEntries = parts.sandboxedPluginEntries;
        this._hooks = parts.hooks;
        this.enabledPlugins = parts.enabledPlugins;
        this.pluginStates = parts.pluginStates;
        this.config = parts.config;
        this.mediaProviders = parts.mediaProviders;
        this.mediaProviderEntries = parts.mediaProviderEntries;
        this.cronExecutor = parts.cronExecutor;
        this.cronScheduler = parts.cronScheduler;
        this.email = parts.emailPipeline;
        this.allPipelinePlugins = parts.allPipelinePlugins;
        this.pipelineFactoryOptions = parts.pipelineFactoryOptions;
        this.runtimeDeps = parts.runtimeDeps;
        this.pipelineRef = parts.pipelineRef;
    }
    /**
     * Get the sandbox runner instance (for marketplace install/update)
     */
    getSandboxRunner() {
        return sandboxRunner;
    }
    /**
     * Whether the sandbox bypass mode (sandbox: false) is active.
     * Marketplace install/update handlers use this to skip the
     * SANDBOX_NOT_AVAILABLE gate, since the bypass path loads
     * marketplace plugins in-process via syncMarketplacePlugins().
     */
    isSandboxBypassed() {
        return this.runtimeDeps.sandboxBypassed === true;
    }
    /**
     * Publish any content whose scheduled time has passed.
     * Returns the items promoted so callers can invalidate their cache tags.
     */
    async publishScheduled() {
        return this.publishScheduledWithFence();
    }
    async publishScheduledWithFence(onPublished) {
        const recordWrite = await assertSiteWriteAllowed(this.db);
        const currentTime = this.runtimeDeps.now?.() ?? new Date();
        const published = await publishDueContent(this.db, {
            publish: (collection, id, options) => this.handleContentPublish(collection, id, {
                ...options,
                origin: { source: "scheduler" },
            }),
            onPublished,
            currentTime,
        });
        if (published.length > 0)
            await recordWrite();
        return published;
    }
    /**
     * Run the full scheduled-maintenance batch: cron tasks, scheduled
     * publishing, and system cleanup. For request-less drivers — the
     * Cloudflare `scheduled()` handler invokes this from a Cron Trigger.
     * (On Node the timer-based scheduler drives the same work itself.)
     *
     * Each step is independent and non-fatal. Returns the content promoted
     * by the publishing sweep so the caller can purge edge-cache tags.
     *
     * `onPublished` (optional) is awaited after each collection's batch so a
     * request-less driver can invalidate edge-cache tags incrementally rather
     * than only after the whole sweep — bounding stale-cache exposure if the
     * runtime is killed mid-sweep.
     */
    async runScheduledTasks(options = {}) {
        const { published } = await this.runScheduledTasksWithStats(options);
        return { published };
    }
    async runScheduledTasksWithStats(options = {}) {
        if (options.invalidateContentCache) {
            this.pluginContentCacheInvalidator = options.invalidateContentCache;
        }
        let processed = 0;
        if (this.cronExecutor) {
            try {
                processed = await this.cronExecutor.tick();
            }
            catch (error) {
                console.error("[cron] Tick failed:", error);
            }
            try {
                await this.cronExecutor.recoverStaleLocks();
            }
            catch (error) {
                console.error("[cron] Stale lock recovery failed:", error);
            }
        }
        let published = [];
        try {
            published = await this.publishScheduledWithFence(options.onPublished);
        }
        catch (error) {
            console.error("[scheduled-publish] Sweep failed:", error);
        }
        try {
            await runSystemCleanup(this.db, this.storage ?? undefined);
        }
        catch (error) {
            console.error("[cleanup] System cleanup failed:", error);
        }
        try {
            await this.syncPluginStorageIndexesOnce();
        }
        catch (error) {
            console.error("[plugins] Storage index sync failed:", error);
        }
        // Never throws; no-op unless scheduled backups are enabled and due.
        await maybeRunScheduledBackup(this.db, this.storage ?? undefined);
        await recordSchedulerHeartbeatSafely(this.db);
        return { processed, published };
    }
    /**
     * Materialize plugin-declared storage indexes, once per process.
     *
     * Called from the scheduler path, not from request handlers — configured
     * plugins have no install handler, so the tick is their only sync moment.
     */
    async syncPluginStorageIndexesOnce() {
        if (this.storageIndexesSynced)
            return;
        this.storageIndexesSynced = true;
        // Sandboxed marketplace/registry plugins never join allPipelinePlugins;
        // their manifests are cached at bundle load. Without them, plugins
        // installed before this feature shipped would never get their indexes.
        await syncDeclaredStorageIndexes(this.db, [
            ...this.allPipelinePlugins,
            ...marketplaceManifestCache.values(),
        ]);
    }
    /**
     * Stop the cron scheduler gracefully.
     * Call during worker shutdown or hot-reload.
     */
    async stopCron() {
        if (this.cronScheduler) {
            await this.cronScheduler.stop();
        }
    }
    /** Stop background work and discard loaded sandbox isolates. */
    async shutdown() {
        await this.stopCron();
        sandboxRunner?.setCommentModerate?.(null);
        await sandboxRunner?.terminateAll();
        sandboxRunner = null;
        sandboxedPluginCache.clear();
        sandboxedManifestCache.clear();
        sandboxedRouteMetaCache.clear();
        marketplaceManifestCache.clear();
        marketplacePluginKeys.clear();
        registryPluginKeys.clear();
    }
    /**
     * Update in-memory plugin status and rebuild the hook pipeline.
     *
     * Rebuilding the pipeline ensures disabled plugins' hooks stop firing
     * and re-enabled plugins' hooks start firing again without a restart.
     * Exclusive hook selections are re-resolved after each rebuild.
     */
    async setPluginStatus(pluginId, status) {
        this.pluginStates.set(pluginId, status);
        if (status === "active") {
            this.setSandboxedPluginActive(pluginId, true);
            this.enabledPlugins.add(pluginId);
            await this.rebuildHookPipeline();
            await this._hooks.runPluginActivate(pluginId);
        }
        else {
            try {
                // Deactivate hooks retain access until their cleanup has finished.
                await this._hooks.runPluginDeactivate(pluginId);
            }
            finally {
                this.setSandboxedPluginActive(pluginId, false);
                this.enabledPlugins.delete(pluginId);
                await this.rebuildHookPipeline();
            }
        }
    }
    setSandboxedPluginActive(pluginId, active) {
        for (const [key, plugin] of this.sandboxedPlugins) {
            if (key.slice(0, key.lastIndexOf(":")) === pluginId) {
                plugin.setActive?.(active);
            }
        }
    }
    async handlePluginEnable(pluginId) {
        return enableRuntimePlugin(this, pluginId);
    }
    async handlePluginDisable(pluginId) {
        return disableRuntimePlugin(this, pluginId);
    }
    /** Dispatch teardown lifecycle while the runtime-installed isolate is still loaded. */
    async runPluginUninstallLifecycle(pluginId, deleteData) {
        const active = this.isPluginEnabled(pluginId);
        if (active) {
            try {
                await this._hooks.runPluginDeactivate(pluginId);
            }
            catch (error) {
                console.error(`EmDash: Plugin ${pluginId} deactivate hook failed during uninstall:`, error);
            }
        }
        try {
            const results = await this._hooks.runPluginUninstall(pluginId, deleteData);
            if (results.length > 0)
                return;
            await this.findSandboxedPlugin(pluginId)?.invokeHook("plugin:uninstall", { deleteData });
        }
        catch (error) {
            console.error(`EmDash: Plugin ${pluginId} uninstall hook failed:`, error);
        }
    }
    async runPluginInstallLifecycle(pluginId) {
        await this._hooks.runPluginInstall(pluginId);
        await this._hooks.runPluginActivate(pluginId);
    }
    async runPluginActivateLifecycle(pluginId) {
        await this._hooks.runPluginActivate(pluginId);
    }
    /**
     * Rebuild the hook pipeline from the current set of enabled plugins.
     *
     * Filters `allPipelinePlugins` to only those in `enabledPlugins`,
     * creates a fresh HookPipeline, re-resolves exclusive hook selections,
     * and re-wires the context factory so existing references (cron
     * callbacks, email pipeline) use the new pipeline.
     */
    async rebuildHookPipeline() {
        const enabledList = this.allPipelinePlugins.filter((p) => this.enabledPlugins.has(p.id));
        const newPipeline = createHookPipeline(enabledList, this.pipelineFactoryOptions);
        // Re-resolve exclusive hooks against the new pipeline
        await EmDashRuntime.resolveExclusiveHooks(newPipeline, this.db, this.runtimeDeps);
        // Carry over context factory options from the old pipeline so that
        // email, cron reschedule, and other wired-in options are preserved.
        // The old pipeline's contextFactoryOptions were built up incrementally
        // via setContextFactory calls during create(). We replay them here.
        if (this.email) {
            // db/getDb are already wired by createHookPipeline above (they live in
            // pipelineFactoryOptions), so the merge only adds emailPipeline.
            newPipeline.setContextFactory({ emailPipeline: this.email });
        }
        newPipeline.setContextFactory({
            // Plugin schedules remain database-backed when no in-process scheduler
            // exists; an external trigger is responsible for invoking due tasks.
            cronReschedule: () => this.cronScheduler?.reschedule(),
        });
        // Update the email pipeline to use the new hook pipeline
        if (this.email) {
            this.email.setPipeline(newPipeline);
        }
        // Update the mutable ref so the cron closure dispatches through
        // the new pipeline without needing to reconstruct the CronExecutor.
        this.pipelineRef.current = newPipeline;
        this._hooks = newPipeline;
    }
    /**
     * Synchronize marketplace plugin runtime state with DB + storage.
     *
     * Ensures install/update/uninstall changes take effect immediately in the
     * current worker: loads newly active plugins and removes uninstalled ones.
     */
    async syncMarketplacePlugins() {
        if (!this.config.marketplace)
            return;
        // In sandbox bypass mode (sandbox: false), the noop runner reports
        // unavailable but we still want admin metadata for newly installed
        // marketplace plugins to refresh in-process. Hooks/routes still won't
        // execute (matches the cold-start bypass behavior), but Configure
        // links and admin pages appear immediately.
        if (this.runtimeDeps.sandboxBypassed) {
            await this.syncMarketplacePluginsBypassed();
            return;
        }
        await this.syncSandboxedSourcePlugins("marketplace");
    }
    /**
     * Synchronize registry plugin runtime state with DB + storage.
     *
     * Mirrors {@link syncMarketplacePlugins} for plugins installed via the
     * experimental decentralized plugin registry. Called after install,
     * update, and uninstall handlers complete.
     */
    async syncRegistryPlugins() {
        if (!getRegistryConfigInput(this.config.registry))
            return;
        await this.syncSandboxedSourcePlugins("registry");
    }
    /**
     * Internal: reconcile in-memory sandboxed-plugin state with the
     * `_plugin_state` table for the given source tier. Shared
     * implementation behind {@link syncMarketplacePlugins} and
     * {@link syncRegistryPlugins}.
     *
     * Each source tier has its own key set in `${source}PluginKeys` so a
     * sync for one tier doesn't invalidate the other.
     */
    async syncSandboxedSourcePlugins(source) {
        if (!this.storage)
            return;
        if (!sandboxRunner || !sandboxRunner.isAvailable())
            return;
        const keySet = source === "marketplace" ? marketplacePluginKeys : registryPluginKeys;
        let pipelineChanged = false;
        try {
            const stateRepo = new PluginStateRepository(this.db);
            const states = source === "marketplace"
                ? await stateRepo.getMarketplacePlugins()
                : await stateRepo.getRegistryPlugins();
            const desired = new Map();
            for (const state of states) {
                this.pluginStates.set(state.pluginId, state.status);
                if (state.status === "active") {
                    this.enabledPlugins.add(state.pluginId);
                }
                else {
                    this.enabledPlugins.delete(state.pluginId);
                }
                if (state.status !== "active")
                    continue;
                // Marketplace plugins use `marketplaceVersion` when present;
                // registry plugins always use `version`.
                const desiredVersion = source === "marketplace" ? (state.marketplaceVersion ?? state.version) : state.version;
                desired.set(state.pluginId, desiredVersion);
            }
            // Remove uninstalled or no-longer-active plugins from memory.
            const keysToRemove = [];
            for (const key of keySet) {
                const [pluginId] = key.split(":");
                if (!pluginId)
                    continue;
                const desiredVersion = desired.get(pluginId);
                if (desiredVersion && key === `${pluginId}:${desiredVersion}`)
                    continue;
                keysToRemove.push(key);
            }
            for (const key of keysToRemove) {
                const [pluginId] = key.split(":");
                if (!pluginId)
                    continue;
                const desiredVersion = desired.get(pluginId);
                if (!desiredVersion) {
                    this.pluginStates.delete(pluginId);
                    this.enabledPlugins.delete(pluginId);
                }
                const existing = sandboxedPluginCache.get(key);
                if (existing) {
                    try {
                        await existing.terminate();
                    }
                    catch (error) {
                        console.warn(`EmDash: Failed to terminate sandboxed plugin ${key}:`, error);
                    }
                }
                sandboxedPluginCache.delete(key);
                sandboxedManifestCache.delete(key);
                this.sandboxedPlugins.delete(key);
                this.removePluginFromLists(pluginId);
                keySet.delete(key);
                pipelineChanged = true;
                if (pluginId) {
                    sandboxedRouteMetaCache.delete(pluginId);
                    marketplaceManifestCache.delete(pluginId);
                }
            }
            // Load newly active plugins.
            for (const [pluginId, version] of desired) {
                const key = `${pluginId}:${version}`;
                if (sandboxedPluginCache.has(key)) {
                    keySet.add(key);
                    continue;
                }
                const bundle = await loadBundleFromR2(this.storage, pluginId, version, source);
                if (!bundle) {
                    console.warn(`EmDash: ${source} plugin ${pluginId}@${version} not found in R2`);
                    continue;
                }
                const loaded = await sandboxRunner.load(bundle.manifest, bundle.backendCode);
                sandboxedPluginCache.set(key, loaded);
                sandboxedManifestCache.set(key, bundle.manifest);
                this.sandboxedPlugins.set(key, loaded);
                this.allPipelinePlugins.push(createSandboxedPluginProxy(bundle.manifest, loaded));
                keySet.add(key);
                pipelineChanged = true;
                // Cache manifest admin config for getManifest()
                marketplaceManifestCache.set(pluginId, {
                    id: bundle.manifest.id,
                    version: bundle.manifest.version,
                    admin: bundle.manifest.admin,
                    mcp: bundle.manifest.mcp,
                    storage: bundle.manifest.storage,
                    allowedHosts: bundle.manifest.allowedHosts,
                    capabilities: bundle.manifest.capabilities,
                });
                // Cache route metadata from manifest for auth decisions
                if (bundle.manifest.routes.length > 0) {
                    const routeMetaMap = new Map();
                    for (const entry of bundle.manifest.routes) {
                        const normalized = normalizeManifestRoute(entry);
                        routeMetaMap.set(normalized.name, buildRouteMeta(normalized));
                    }
                    sandboxedRouteMetaCache.set(pluginId, routeMetaMap);
                }
                else {
                    sandboxedRouteMetaCache.delete(pluginId);
                }
            }
            if (pipelineChanged) {
                await this.rebuildHookPipeline();
            }
        }
        catch (error) {
            console.error(`EmDash: Failed to sync ${source} plugins:`, error);
        }
    }
    /**
     * Remove a plugin from the in-memory pipeline lists by ID.
     * Mutates allPipelinePlugins and configuredPlugins in place.
     */
    removePluginFromLists(pluginId) {
        const allIdx = this.allPipelinePlugins.findIndex((p) => p.id === pluginId);
        if (allIdx !== -1)
            this.allPipelinePlugins.splice(allIdx, 1);
        const configIdx = this.configuredPlugins.findIndex((p) => p.id === pluginId);
        if (configIdx !== -1)
            this.configuredPlugins.splice(configIdx, 1);
    }
    /**
     * Sync marketplace plugin metadata in sandbox: false bypass mode.
     *
     * In bypass mode the noop runner can't load plugins, but admin pages,
     * widgets, and route metadata still need to refresh in-process when an
     * admin installs/updates/uninstalls a marketplace plugin. Otherwise the
     * admin UI shows stale data until the server restarts.
     *
     * Hooks and routes still won't execute under bypass (matches the
     * cold-start bypass behavior in loadMarketplacePluginsBypassed).
     *
     * Known limitation: bypass plugins are loaded via `import(dataUrl)`,
     * which Node's ESM cache keys on the full URL. Updates create fresh
     * module objects, but old ones remain cached for the worker's lifetime.
     * In practice this is a few KB per update — only matters for sites with
     * very frequent marketplace updates running long-lived processes. The
     * fix would be vm.SourceTextModule for explicit lifecycle management.
     */
    async syncMarketplacePluginsBypassed() {
        if (!this.storage)
            return;
        try {
            const stateRepo = new PluginStateRepository(this.db);
            const marketplaceStates = await stateRepo.getMarketplacePlugins();
            const desired = new Map();
            for (const state of marketplaceStates) {
                this.pluginStates.set(state.pluginId, state.status);
                if (state.status === "active") {
                    this.enabledPlugins.add(state.pluginId);
                }
                else {
                    this.enabledPlugins.delete(state.pluginId);
                }
                if (state.status !== "active")
                    continue;
                desired.set(state.pluginId, state.marketplaceVersion ?? state.version);
            }
            // Drop metadata for plugins no longer active.
            const toRemove = [];
            for (const pluginId of marketplaceManifestCache.keys()) {
                if (!desired.has(pluginId))
                    toRemove.push(pluginId);
            }
            for (const pluginId of toRemove) {
                // Fire plugin:deactivate hook before removal
                const resolved = this.allPipelinePlugins.find((p) => p.id === pluginId);
                if (resolved) {
                    try {
                        const deactivateHook = resolved.hooks?.["plugin:deactivate"];
                        if (deactivateHook) {
                            const handler = typeof deactivateHook === "function" ? deactivateHook : deactivateHook.handler;
                            if (typeof handler === "function") {
                                // Sandbox-bypass cleanup: the plugin context isn't constructable
                                // here (no DB binding, no media, etc.), but well-behaved
                                // deactivate hooks should be no-op safe. If a hook does require
                                // ctx, it throws and the surrounding catch logs it.
                                // eslint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- best-effort cleanup; see comment above
                                await handler({ pluginId }, {});
                            }
                        }
                    }
                    catch (err) {
                        console.warn(`[emdash] plugin:deactivate hook failed for ${pluginId}:`, err);
                    }
                }
                marketplaceManifestCache.delete(pluginId);
                sandboxedRouteMetaCache.delete(pluginId);
                // Remove from pipeline lists too (mutate in place since the
                // arrays are readonly references but mutable contents)
                this.removePluginFromLists(pluginId);
                this.enabledPlugins.delete(pluginId);
            }
            // Load plugin code, adapt as trusted plugins, and add to pipeline lists
            const { adaptSandboxEntry } = await import("./plugins/adapt-sandbox-entry.js");
            const newPlugins = [];
            for (const [pluginId, version] of desired) {
                const bundle = await loadBundleFromR2(this.storage, pluginId, version);
                if (!bundle) {
                    console.warn(`EmDash: Marketplace plugin ${pluginId}@${version} not found in R2`);
                    continue;
                }
                marketplaceManifestCache.set(pluginId, {
                    id: bundle.manifest.id,
                    version: bundle.manifest.version,
                    admin: bundle.manifest.admin,
                    mcp: bundle.manifest.mcp,
                    storage: bundle.manifest.storage,
                    allowedHosts: bundle.manifest.allowedHosts,
                    capabilities: bundle.manifest.capabilities,
                });
                if (bundle.manifest.routes.length > 0) {
                    const routeMetaMap = new Map();
                    for (const entry of bundle.manifest.routes) {
                        const normalized = normalizeManifestRoute(entry);
                        routeMetaMap.set(normalized.name, buildRouteMeta(normalized));
                    }
                    sandboxedRouteMetaCache.set(pluginId, routeMetaMap);
                }
                else {
                    sandboxedRouteMetaCache.delete(pluginId);
                }
                // Skip if already in the pipeline at this version
                const existing = this.allPipelinePlugins.find((p) => p.id === pluginId);
                if (existing && existing.version === bundle.manifest.version)
                    continue;
                // Remove any older version
                if (existing) {
                    this.removePluginFromLists(pluginId);
                }
                try {
                    const dataUrl = `data:text/javascript;base64,${Buffer.from(bundle.backendCode).toString("base64")}`;
                    // Dynamic data: import returns `any` from a base64-encoded module.
                    // We trust the bundle to be shaped like a plugin (built by plugin-cli);
                    // adaptSandboxEntry then validates fields it cares about.
                    // eslint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- dynamic module from trusted bundle
                    const pluginModule = (await import(/* @vite-ignore */ dataUrl));
                    const pluginDef = (pluginModule.default ?? pluginModule);
                    const adapted = adaptSandboxEntry(pluginDef, {
                        id: bundle.manifest.id,
                        version: bundle.manifest.version,
                        entrypoint: "",
                        capabilities: bundle.manifest.capabilities ?? [],
                        allowedHosts: bundle.manifest.allowedHosts ?? [],
                        // eslint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- adaptSandboxEntry copies storage through
                        storage: (bundle.manifest.storage ?? {}),
                        adminPages: bundle.manifest.admin?.pages,
                        adminWidgets: bundle.manifest.admin?.widgets?.map((w) => ({
                            id: w.id,
                            title: w.title,
                            size: w.size === "full" || w.size === "half" || w.size === "third" ? w.size : undefined,
                        })),
                        settingsSchema: bundle.manifest.admin?.settingsSchema,
                        editorPanels: bundle.manifest.admin?.editorPanels,
                        editorActions: bundle.manifest.admin?.editorActions,
                        mcp: bundle.manifest.mcp,
                    });
                    newPlugins.push(adapted);
                    this.allPipelinePlugins.push(adapted);
                    this.configuredPlugins.push(adapted);
                    this.enabledPlugins.add(adapted.id);
                }
                catch (error) {
                    console.error(`EmDash: Failed to load marketplace plugin ${pluginId}@${version} in-process:`, error);
                }
            }
            // If anything changed, rebuild the hook pipeline so new/removed
            // plugins take effect immediately without a server restart.
            if (toRemove.length > 0 || newPlugins.length > 0) {
                await this.rebuildHookPipeline();
            }
        }
        catch (error) {
            console.error("EmDash: Failed to sync marketplace plugins (bypass):", error);
        }
    }
    /**
     * Create and initialize the runtime
     */
    static async create(deps, timings) {
        // Helper: time a phase and push into the shared timings array when
        // provided. Uses performance.now() — monotonic across async boundaries.
        // No-op when `timings` wasn't passed (preserves backwards compatibility
        // with callers that don't care about per-phase breakdown).
        const phase = async (name, desc, fn) => {
            if (!timings)
                return fn();
            const t0 = performance.now();
            try {
                return await fn();
            }
            finally {
                timings.push({ name, dur: performance.now() - t0, desc });
            }
        };
        // Initialize the database and enforce its configured migration policy.
        const db = await phase("rt.db", "DB init + migration policy", () => EmDashRuntime.getDatabase(deps));
        // Resolver for the live connection, mirroring the `get db()` getter
        // below (which can't be used here — the runtime instance doesn't exist
        // yet). Long-lived subsystems built during create() (cron executor,
        // plugin context factory, media providers) capture this resolver rather
        // than the `db` snapshot, so a connection-backed adapter (Postgres over
        // Hyperdrive) serves their queries from the current request/event-scoped
        // connection in ALS instead of the per-isolate singleton — whose socket
        // belongs to an earlier request and would trip workerd's cross-request
        // I/O guard. Stateless adapters (D1, Node SQLite) set no ALS db on most
        // paths, so this falls back to the singleton: unchanged behavior.
        const resolveDb = () => {
            const ctx = getRequestContext();
            // eslint-disable-next-line typescript/no-unsafe-type-assertion -- ALS db is typed unknown to avoid a circular import; middleware always sets a Kysely<Database>
            return ctx?.db ?? db;
        };
        // Validate EMDASH_ENCRYPTION_KEY once here so a malformed value
        // surfaces in startup logs. Plugin secret-setting operations re-read
        // the key and fail closed at their own boundary, so validation here
        // does not block unrelated request paths.
        await phase("rt.secrets", "Validate encryption key", () => validateEncryptionKeyAtStartup());
        // FTS verify/repair is deferred off the cold-start hot path.
        // See EmDashRuntime.ensureSearchHealthy().
        // Initialize storage (sync)
        const storage = EmDashRuntime.getStorage(deps);
        let pluginStates = new Map();
        const configuredLocales = virtualConfig?.i18n?.locales ?? getI18nConfig()?.locales ?? [];
        const localeCasingRepairVersion = getLocaleCasingRepairVersion(configuredLocales);
        let storedLocaleCasingRepairVersion;
        let siteInfo;
        // "Already complete" by default so a read failure (e.g. tables absent on a
        // pre-migration db) skips seeding rather than seeding a half-built db.
        let seedComplete = true;
        let setupDone = true;
        let seedCollectionsReadable = false;
        // Seeding must only touch the configured singleton, never a borrowed
        // per-request db (playground / DO preview) or the loader-fallback db.
        const reqCtx = getRequestContext();
        const ownsConfiguredDb = !!deps.config.database && !(reqCtx?.dbIsIsolated && reqCtx.db);
        // Run the init reads on a coalescing connection so the concurrent
        // same-turn reads flush as one batch() round trip. The singleton can't:
        // its plain SqliteAdapter reports supportsMultipleConnections=false, so
        // Kysely's connection mutex serializes concurrent reads into N round
        // trips. The connection is per-init and discarded — the long-lived
        // singleton must never coalesce or one request's reads could land in
        // another's batch. Backends without a coalescing dialect (Node/SQLite)
        // fall back to the singleton, where serialization costs nothing.
        let readDb = db;
        let readDbDisposable;
        const disposeReadDb = async () => {
            const disposable = readDbDisposable;
            readDbDisposable = undefined;
            if (!disposable)
                return;
            try {
                await disposable.destroy();
            }
            catch {
                // Non-fatal — the underlying binding is shared and needs no teardown.
            }
        };
        if (ownsConfiguredDb && deps.createCoalescingDialect && deps.config.database) {
            try {
                const dialect = deps.createCoalescingDialect(deps.config.database.config);
                if (dialect) {
                    readDb = new Kysely({ dialect, log: kyselyLogOption() });
                    readDbDisposable = readDb;
                }
            }
            catch {
                readDb = db;
            }
        }
        const optionsRepo = new OptionsRepository(readDb);
        let missingManualSchemaError;
        const captureMissingManualSchema = (error) => {
            if ((deps.migrationMode ?? "auto") === "manual" && isMissingTableError(error)) {
                missingManualSchemaError ??= error;
            }
        };
        const readSiteInfo = async () => {
            const siteOpts = await optionsRepo.getMany([
                "emdash:site_title",
                "emdash:site_url",
                "emdash:locale",
                LOCALE_CASING_REPAIR_OPTION,
                AUTO_SEED_COMPLETE_OPTION,
                SETUP_COMPLETE_OPTION,
            ]);
            const siteTitle = siteOpts.get("emdash:site_title");
            const siteUrl = siteOpts.get("emdash:site_url");
            const locale = siteOpts.get("emdash:locale");
            const repairVersion = siteOpts.get(LOCALE_CASING_REPAIR_OPTION);
            storedLocaleCasingRepairVersion =
                typeof repairVersion === "string" ? repairVersion : undefined;
            seedComplete = siteOpts.get(AUTO_SEED_COMPLETE_OPTION) === true;
            setupDone = siteOpts.get(SETUP_COMPLETE_OPTION) === true;
            return {
                siteName: deps.siteInfo?.name ?? (typeof siteTitle === "string" ? siteTitle : undefined),
                siteUrl: deps.siteInfo?.url ?? (typeof siteUrl === "string" ? siteUrl : undefined),
                locale: deps.siteInfo?.locale ?? (typeof locale === "string" ? locale : undefined),
                // trailingSlash is a build-time Astro routing decision, not a
                // user-editable setting, so it comes from the Astro config
                // (virtual:emdash/config), not the options table.
                trailingSlash: deps.siteInfo?.trailingSlash ?? virtualConfig?.trailingSlash,
            };
        };
        const coldStartReads = [
            phase("rt.plugins", "Plugin states", async () => {
                try {
                    const states = await readDb
                        .selectFrom("_plugin_state")
                        .select(["plugin_id", "status"])
                        .execute();
                    pluginStates = new Map(states.map((s) => [s.plugin_id, s.status]));
                }
                catch (error) {
                    captureMissingManualSchema(error);
                    // _plugin_state may not exist yet on a pre-migration db.
                }
            }),
            phase("rt.site", "Site info options", async () => {
                try {
                    siteInfo = await readSiteInfo();
                }
                catch (error) {
                    captureMissingManualSchema(error);
                    // options may not exist yet on a pre-migration db.
                }
            }),
        ];
        if (ownsConfiguredDb) {
            coldStartReads.push(phase("rt.seedcheck", "Auto-seed gate", async () => {
                try {
                    // Selecting the slugs instead of COUNT(*) costs the same
                    // round trip and primes the registered-collections cache,
                    // so the first render on this isolate skips its own lookup.
                    const collectionRows = await readDb
                        .selectFrom("_emdash_collections")
                        .select("slug")
                        .execute();
                    primeRegisteredCollections(collectionRows.map((row) => row.slug));
                    seedCollectionsReadable = true;
                }
                catch (error) {
                    captureMissingManualSchema(error);
                    // Leave collections unreadable so a read failure never triggers
                    // a seed onto a half-built db.
                }
            }));
        }
        await Promise.all(coldStartReads);
        if (missingManualSchemaError) {
            await disposeReadDb();
            throw missingManualSchemaError;
        }
        if (localeCasingRepairVersion &&
            (configuredLocales.some((locale) => locale.includes("-") || locale !== locale.toLowerCase()) ||
                storedLocaleCasingRepairVersion !== undefined) &&
            storedLocaleCasingRepairVersion !== localeCasingRepairVersion) {
            await phase("rt.locale", "Repair locale casing", async () => {
                await repairLocaleCasing(db, configuredLocales);
                await new OptionsRepository(db).set(LOCALE_CASING_REPAIR_OPTION, localeCasingRepairVersion);
            });
        }
        // Auto-seed the default schema for a first load that skipped the setup
        // wizard (the wizard and dev-bypass apply seeds explicitly). Run under a
        // per-isolate lock keyed by the configured db so a reclaimed-and-rerun
        // create() can't apply the seed a second time concurrently.
        if (seedCollectionsReadable && !seedComplete && !setupDone) {
            try {
                const activation = await activateMediaUsageCapture(db, { writersDrained: true });
                if (activation.outcome !== "active") {
                    throw new Error("Fresh-site media usage activation did not complete");
                }
            }
            catch (error) {
                await disposeReadDb();
                throw error;
            }
            const seedKey = deps.config.database?.entrypoint ?? "default";
            const seedHolder = getSeedHolder();
            try {
                await initWithLock(seedHolder.lock, () => (seedHolder.done.has(seedKey) ? true : undefined), async () => {
                    const { applySeed } = await import("./seed/apply.js");
                    const { loadSeed } = await import("./seed/load.js");
                    const { validateSeed } = await import("./seed/validate.js");
                    const seed = await loadSeed();
                    const validation = validateSeed(seed);
                    if (!validation.valid)
                        return false;
                    const seedResult = await applySeed(db, seed, { onConflict: "skip" });
                    await new OptionsRepository(db).set(AUTO_SEED_COMPLETE_OPTION, true);
                    console.log("Auto-seeded default collections");
                    if (seedResult.taxonomies.skipped > 0) {
                        console.warn(`[auto-seed] Kept ${seedResult.taxonomies.skipped} existing taxonomy definition(s) instead of the seed's. Edit them in the admin, or run \`emdash seed <file> --on-conflict update\` to replace them (this also overwrites other seeded records).`);
                    }
                    seedHolder.done.add(seedKey);
                    return true;
                }, { deadlineMs: DB_INIT_DEADLINE_MS, anchor: (promise) => after(() => promise) });
                // The site-info read ran before the seed wrote its defaults, so
                // refresh the snapshot the plugin context sees.
                try {
                    siteInfo = await readSiteInfo();
                }
                catch {
                    // Non-fatal — plugin context falls back to undefined fields.
                }
            }
            catch {
                // Non-fatal — a failed seed (e.g. missing seed module) leaves the
                // site un-seeded; a later request retries.
            }
        }
        // The read connection is single-use; everything below uses the singleton.
        await disposeReadDb();
        const enabledPlugins = new Set();
        for (const plugin of deps.plugins) {
            const status = pluginStates.get(plugin.id);
            if (status === undefined || status === "active") {
                enabledPlugins.add(plugin.id);
            }
        }
        // Build the full list of pipeline-eligible plugins: all configured
        // plugins (regardless of current enabled status) plus built-in plugins.
        // rebuildHookPipeline() filters this to only enabled plugins.
        const allPipelinePlugins = [...deps.plugins];
        // Collected bypassed plugins (sandbox: false escape hatch).
        // These need to be added to BOTH the pipeline (for hooks) AND the
        // configuredPlugins list (for route dispatch).
        const bypassedPluginsList = [];
        // In dev mode, register a built-in console email provider.
        // It participates in exclusive hook resolution like any other plugin —
        // auto-selected when it's the sole provider, overridden when a real one is configured.
        // Gated by import.meta.env.DEV to prevent silent email loss in production.
        if (import.meta.env.DEV) {
            try {
                const devConsolePlugin = definePlugin({
                    id: DEV_CONSOLE_EMAIL_PLUGIN_ID,
                    version: "0.0.0",
                    capabilities: ["hooks.email-transport:register"],
                    hooks: {
                        "email:deliver": {
                            exclusive: true,
                            handler: devConsoleEmailDeliver,
                        },
                    },
                });
                allPipelinePlugins.push(devConsolePlugin);
                // Built-in plugins are always enabled
                enabledPlugins.add(devConsolePlugin.id);
            }
            catch (error) {
                console.warn("[email] Failed to register dev console email provider:", error);
            }
        }
        // Register built-in default comment moderator.
        // Always present as a fallback: exclusive hook resolution selects a
        // single plugin moderator (e.g. AI moderation) over it unless the site
        // has already stored a comment:moderate selection.
        try {
            const defaultModeratorPlugin = definePlugin({
                id: DEFAULT_COMMENT_MODERATOR_PLUGIN_ID,
                version: "0.0.0",
                capabilities: ["users:read"],
                hooks: {
                    "comment:moderate": {
                        exclusive: true,
                        handler: defaultCommentModerate,
                    },
                },
            });
            allPipelinePlugins.push(defaultModeratorPlugin);
            // Built-in plugins are always enabled
            enabledPlugins.add(defaultModeratorPlugin.id);
        }
        catch (error) {
            console.warn("[comments] Failed to register default moderator:", error);
        }
        // sandbox: false escape hatch - load sandboxed plugin entries in-process
        // as trusted plugins (no isolation) so they participate in the hook pipeline.
        // Block this on Cloudflare Workers where dynamic import(dataUrl) is not
        // available and running untrusted code in-process is a security risk.
        if (deps.sandboxBypassed && deps.sandboxedPluginEntries.length > 0) {
            const isCfWorkers = typeof navigator !== "undefined" &&
                typeof navigator.userAgent === "string" &&
                navigator.userAgent.includes("Cloudflare-Workers");
            if (isCfWorkers) {
                throw new Error("sandbox: false is not supported in Cloudflare Workers. " +
                    "Remove the sandbox: false option or use the Cloudflare sandbox runner.");
            }
            console.info("EmDash: Sandbox disabled (sandbox: false). " +
                "Sandboxed plugins will run in-process without isolation.");
            const bypassedPlugins = await EmDashRuntime.loadBypassedPlugins(deps.sandboxedPluginEntries);
            for (const plugin of bypassedPlugins) {
                allPipelinePlugins.push(plugin);
                bypassedPluginsList.push(plugin);
                // Respect plugin state: only enable if active or no record exists.
                // Plugins an admin previously disabled should stay disabled.
                const status = pluginStates.get(plugin.id);
                if (status === undefined || status === "active") {
                    enabledPlugins.add(plugin.id);
                }
            }
        }
        // In bypass mode, also load marketplace plugins from R2 as trusted
        // in-process plugins BEFORE pipeline creation. They need to be in the
        // pipeline to participate in hook dispatch.
        if (deps.sandboxBypassed && deps.config.marketplace && storage) {
            const marketplaceBypassed = await EmDashRuntime.loadMarketplacePluginsBypassed(db, storage);
            for (const plugin of marketplaceBypassed) {
                allPipelinePlugins.push(plugin);
                bypassedPluginsList.push(plugin);
                const status = pluginStates.get(plugin.id);
                if (status === undefined || status === "active") {
                    enabledPlugins.add(plugin.id);
                }
            }
        }
        // Load sandboxed plugins (build-time, sandbox runner path)
        const sandboxedPluginPool = await phase("rt.sandbox", "Sandboxed plugins", () => EmDashRuntime.loadSandboxedPlugins(deps, db, storage, siteInfo));
        for (const [key, plugin] of sandboxedPluginPool) {
            const pluginId = key.slice(0, key.lastIndexOf(":"));
            const status = pluginStates.get(pluginId);
            plugin.setActive?.(status === undefined || status === "active");
        }
        // Cold-start: load marketplace- and registry-installed plugins from
        // site R2 via the sandbox runner. The two tiers only depend on the
        // sandbox phase above, not on each other, so when both are enabled
        // they run concurrently instead of paying two sequential loads.
        // In bypass mode marketplace plugins were already handled above.
        const installedTierPhases = [];
        if (deps.config.marketplace && storage && !deps.sandboxBypassed) {
            installedTierPhases.push(phase("rt.market", "Marketplace plugins", () => EmDashRuntime.loadInstalledSandboxedPlugins("marketplace", db, storage, deps, sandboxedPluginPool, siteInfo)));
        }
        // Cold-start: load registry-installed plugins from site R2
        if (getRegistryConfigInput(deps.config.registry) && storage) {
            installedTierPhases.push(phase("rt.registry", "Registry plugins", () => EmDashRuntime.loadInstalledSandboxedPlugins("registry", db, storage, deps, sandboxedPluginPool, siteInfo)));
        }
        if (installedTierPhases.length > 0) {
            await Promise.all(installedTierPhases);
        }
        const configuredSandboxIds = new Set(deps.sandboxedPluginEntries.map((entry) => entry.id));
        const sandboxedPlugins = new Map([...sandboxedPluginPool].filter(([pluginKey]) => {
            const pluginId = pluginKey.slice(0, pluginKey.lastIndexOf(":"));
            return configuredSandboxIds.has(pluginId) || pluginStates.get(pluginId) === "active";
        }));
        // Add isolate-backed proxies to the same host pipeline as trusted
        // plugins. The proxy carries only manifest metadata and RPC handlers;
        // plugin code remains inside the configured runner.
        for (const [pluginKey, instance] of sandboxedPlugins) {
            const manifest = sandboxedManifestCache.get(pluginKey);
            if (!manifest)
                continue;
            allPipelinePlugins.push(createSandboxedPluginProxy(manifest, instance));
            const status = pluginStates.get(manifest.id);
            if (status === undefined || status === "active")
                enabledPlugins.add(manifest.id);
        }
        // Create hook pipeline. getDb travels here (not just via the email
        // setContextFactory call below) so it survives rebuildHookPipeline(),
        // which reconstructs the factory from pipelineFactoryOptions. Without it,
        // toggling a plugin on an email-less deployment would silently revert
        // plugin contexts to the singleton db — re-breaking connection-backed
        // adapters. See #1622.
        const runtimeRef = { current: null };
        const requireRuntime = () => {
            if (!runtimeRef.current)
                throw new Error("EmDash runtime is not ready");
            return runtimeRef.current;
        };
        const contentActions = {
            begin: (pluginId, invocationId, invalidateContentCache) => requireRuntime().beginPluginInvocation(pluginId, invocationId, invalidateContentCache),
            flush: (pluginId, invocationId, final) => requireRuntime().flushPluginAfterHooks(pluginId, invocationId, final),
            getVersioned: (pluginId, collection, id) => requireRuntime().pluginGetVersioned(pluginId, collection, id),
            publish: (pluginId, collection, id, options, invocationId, invalidateContentCache) => requireRuntime().pluginPublish(pluginId, collection, id, options, invocationId, invalidateContentCache),
            unpublish: (pluginId, collection, id, options, invocationId, invalidateContentCache) => requireRuntime().pluginUnpublish(pluginId, collection, id, options, invocationId, invalidateContentCache),
            schedule: (pluginId, collection, id, options, invocationId, invalidateContentCache) => requireRuntime().pluginSchedule(pluginId, collection, id, options, invocationId, invalidateContentCache),
            unschedule: (pluginId, collection, id, options, invocationId, invalidateContentCache) => requireRuntime().pluginUnschedule(pluginId, collection, id, options, invocationId, invalidateContentCache),
            getTrashedVersioned: (pluginId, collection, id) => requireRuntime().pluginGetTrashedVersioned(pluginId, collection, id),
            restore: (pluginId, collection, id, options, invocationId, invalidateContentCache) => requireRuntime().pluginRestore(pluginId, collection, id, options, invocationId, invalidateContentCache),
        };
        const pipelineFactoryOptions = {
            db,
            getDb: resolveDb,
            beforeContentWrite: () => assertSiteWriteAllowed(resolveDb()),
            contentActions,
            now: deps.now,
            storage: storage ?? undefined,
            siteInfo,
            commentModerate: (pluginId, id, status, expectedStatus) => {
                const current = runtimeRef.current;
                if (!current)
                    throw new Error("Comment moderation is unavailable during runtime startup");
                return current.handlePluginCommentModerate(pluginId, id, status, expectedStatus);
            },
        };
        const enabledPluginList = allPipelinePlugins.filter((p) => enabledPlugins.has(p.id));
        const pipeline = createHookPipeline(enabledPluginList, pipelineFactoryOptions);
        // Initialize media providers
        const mediaProviders = new Map();
        const mediaProviderEntries = deps.mediaProviderEntries ?? [];
        const providerContext = { db, storage, getDb: resolveDb };
        for (const entry of mediaProviderEntries) {
            try {
                const provider = entry.createProvider(providerContext);
                mediaProviders.set(entry.id, provider);
            }
            catch (error) {
                console.warn(`Failed to initialize media provider "${entry.id}":`, error);
            }
        }
        // Resolve exclusive hooks — auto-select providers and sync with DB
        await phase("rt.hooks", "Exclusive hook resolution", () => EmDashRuntime.resolveExclusiveHooks(pipeline, db, deps));
        // ── Email pipeline ───────────────────────────────────────────────
        // The email pipeline orchestrates beforeSend → deliver → afterSend.
        // The dev console provider was registered above and will be auto-selected
        // by resolveExclusiveHooks if it's the sole email:deliver provider.
        const emailPipeline = new EmailPipeline(pipeline);
        // Wire email send into sandbox runner (created earlier but without
        // email pipeline since it didn't exist yet)
        if (sandboxRunner) {
            sandboxRunner.setEmailSend((message, pluginId) => emailPipeline.send(message, pluginId));
        }
        // ── Cron system ──────────────────────────────────────────────────
        // Create executor with a hook dispatch function that uses the pipeline.
        // The callback reads from a mutable ref so that rebuildHookPipeline()
        // can swap the pipeline without reconstructing the CronExecutor.
        const pipelineRef = { current: pipeline };
        const invokeCronHook = async (pluginId, event) => {
            const result = await pipelineRef.current.invokeCronHook(pluginId, event);
            if (!result.success && result.error) {
                throw result.error;
            }
        };
        // Wire email pipeline into context factory (independent of cron —
        // must not be inside the cron try/catch or ctx.email breaks when cron fails).
        // db/getDb were already set via pipelineFactoryOptions above; merge only
        // adds emailPipeline.
        pipeline.setContextFactory({ emailPipeline });
        let cronExecutor = null;
        let cronScheduler = null;
        // Populated with the constructed runtime just before this method returns,
        // so the timer scheduler's cleanup can route scheduled publishing through
        // the runtime wrapper (firing content:afterPublish hooks). The first tick
        // is ≥1s out, well after the synchronous assignment below.
        await phase("rt.cron", "Cron init (recovery deferred post-response)", async () => {
            try {
                cronExecutor = new CronExecutor(resolveDb, invokeCronHook, deps.now);
                // Plugin schedules are always database-backed. On long-lived runtimes this
                // callback also wakes the timer; on Cloudflare the external Cron Trigger
                // drives execution, so rescheduling is intentionally a no-op.
                pipeline.setContextFactory({
                    cronReschedule: () => cronScheduler?.reschedule(),
                });
                // Recover stale locks from previous crashes. Pure bookkeeping
                // against the _emdash_cron_tasks table — no request needs the
                // result — so we defer it past the response via after(). On
                // Cloudflare this goes into waitUntil (extending the worker
                // lifetime); on Node it's fire-and-forget (the process stays
                // up anyway). Saves one cold-start write per D1 isolate.
                const executorForRecovery = cronExecutor;
                after(async () => {
                    try {
                        const recovered = await executorForRecovery.recoverStaleLocks();
                        if (recovered > 0) {
                            console.log(`[cron] Recovered ${recovered} stale task lock(s)`);
                        }
                    }
                    catch (error) {
                        // Keep the `[cron]` prefix so a failure is easy to trace back
                        // rather than surfacing as a generic deferred-task error.
                        console.error("[cron] Failed to recover stale task locks:", error);
                    }
                });
                // The platform decides whether a long-lived timer heartbeat exists.
                // `createScheduler` is injected by the generated virtual:emdash/scheduler
                // module: a NodeCronScheduler factory on Node/Bun, or null on serverless
                // adapters (e.g. Cloudflare) where the Worker's `scheduled()` handler
                // drives runScheduledTasks() instead. No adapter check lives here.
                if (deps.createScheduler) {
                    const scheduler = deps.createScheduler(cronExecutor);
                    cronScheduler = scheduler;
                    // Run scheduled publishing and system cleanup alongside each tick.
                    // Pass storage so cleanupPendingUploads can delete orphaned files.
                    scheduler.setSystemCleanup(async () => {
                        try {
                            // Route through the runtime so content:afterPublish hooks fire.
                            // Falls back to the raw handler if (improbably) the tick beats
                            // the post-construction ref assignment.
                            const runtime = runtimeRef.current;
                            if (runtime) {
                                await runtime.publishScheduled();
                            }
                            else {
                                const recordWrite = await assertSiteWriteAllowed(db);
                                if ((await publishDueContent(db)).length > 0)
                                    await recordWrite();
                            }
                        }
                        catch (error) {
                            console.error("[scheduled-publish] Sweep failed:", error);
                        }
                        try {
                            await runSystemCleanup(db, storage ?? undefined);
                        }
                        catch (error) {
                            // Non-fatal -- individual cleanup failures are already logged
                            // by runSystemCleanup. This catches unexpected errors.
                            console.error("[cleanup] System cleanup failed:", error);
                        }
                        try {
                            await runtimeRef.current?.syncPluginStorageIndexesOnce();
                        }
                        catch (error) {
                            console.error("[plugins] Storage index sync failed:", error);
                        }
                        // Never throws; no-op unless scheduled backups are enabled and due.
                        await maybeRunScheduledBackup(db, storage ?? undefined);
                        await recordSchedulerHeartbeatSafely(db);
                    });
                    // start() is void on the timer scheduler but the interface
                    // allows a promise (alarm-backed schedulers); we don't block on it.
                    void scheduler.start();
                }
            }
            catch (error) {
                console.warn("[cron] Failed to initialize cron system:", error);
                // Non-fatal — CMS works without cron
            }
        });
        sandboxRunner?.setCronReschedule?.(() => cronScheduler?.reschedule());
        const runtime = new EmDashRuntime({
            db,
            storage,
            // Include bypassed sandboxed plugins in configuredPlugins so route
            // dispatch can find them under sandbox: false (they're treated as
            // trusted plugins for the duration of the bypass).
            configuredPlugins: [...deps.plugins, ...bypassedPluginsList],
            sandboxedPlugins,
            sandboxedPluginEntries: deps.sandboxedPluginEntries,
            hooks: pipeline,
            enabledPlugins,
            pluginStates,
            config: deps.config,
            mediaProviders,
            mediaProviderEntries,
            cronExecutor,
            cronScheduler,
            emailPipeline,
            allPipelinePlugins,
            pipelineFactoryOptions,
            runtimeDeps: deps,
            pipelineRef,
        });
        const contentCreate = async (_pluginId, collection, input, options) => {
            const { seo, ...data } = input;
            const result = await runtime.handleContentCreate(collection, {
                data,
                seo,
                locale: resolveContentCreateLocale(options?.locale),
                translationOf: options?.translationOf,
            }, {
                skipSaveHooks: options?.sandboxOrigin
                    ? options.originHook !== undefined
                    : getActiveContentSaveHookName() != null,
                excludeAfterSavePluginId: _pluginId,
            });
            if (!result.success) {
                throw Object.assign(new Error(result.error.message), {
                    name: result.error.code,
                    code: result.error.code,
                });
            }
            return result.data.item;
        };
        runtime.pipelineFactoryOptions.contentCreate = contentCreate;
        pipeline.setContextFactory({ contentCreate });
        sandboxRunner?.setContentCreate?.(contentCreate);
        // Hand the constructed instance to the scheduler-cleanup closure so the
        // timer-driven sweep can fire publish hooks (see runtimeRef above).
        runtimeRef.current = runtime;
        sandboxRunner?.setCommentModerate?.((pluginId, id, status, expectedStatus) => runtime.handlePluginCommentModerate(pluginId, id, status, expectedStatus));
        sandboxRunner?.setContentActions?.(contentActions);
        return runtime;
    }
    /**
     * Get a media provider by ID
     */
    getMediaProvider(providerId) {
        return this.mediaProviders.get(providerId);
    }
    /**
     * Get all media provider entries (for admin UI)
     */
    getMediaProviderList() {
        return this.mediaProviderEntries.map((e) => ({
            id: e.id,
            name: e.name,
            icon: e.icon,
            capabilities: e.capabilities,
        }));
    }
    /**
     * Get or create database instance
     */
    static async getDatabase(deps) {
        // Only use the per-request `ctx.db` when it's an isolated instance
        // (playground / DO preview). Plain D1 Sessions set `ctx.db` on every
        // anonymous request — if we captured one of those session-bound
        // Kyselys into the cached runtime, every request would accidentally
        // share one request's session. The configured `deps.createDialect`
        // path gives us a fresh singleton instead.
        const ctx = getRequestContext();
        if (ctx?.dbIsIsolated && ctx.db) {
            // eslint-disable-next-line typescript/no-unsafe-type-assertion -- db in context is typed as unknown to avoid circular deps
            return ctx.db;
        }
        const dbConfig = deps.config.database;
        // If no database configured in integration, try to get from loader
        if (!dbConfig) {
            try {
                return await getDb();
            }
            catch {
                throw new Error("EmDash database not configured. Either configure database in astro.config.mjs or use emdashLoader in live.config.ts");
            }
        }
        const cacheKey = dbConfig.entrypoint;
        // Waiters poll the cache rather than sharing the initializing request's
        // promise: if the request that owns the init is cancelled mid-await
        // (e.g. client disconnect during cold migrations), a shared promise
        // never settles — and the owner's `finally` that would clear it never
        // runs — deadlocking every later request in the isolate. Prevention:
        // the in-flight init is anchored via after()/waitUntil so a cancelled
        // owner's init still completes and populates the cache. Net: a stale
        // lock is reclaimed after a deadline.
        const holder = getDbHolder();
        const throwIfBackingOff = () => {
            const failure = holder.failures.get(cacheKey);
            if (!failure)
                return;
            if (Date.now() - failure.at < DB_INIT_FAILURE_BACKOFF_MS) {
                throw new Error(`Database initialization is backing off after a recent migration failure: ${failure.message}`);
            }
            // Expired — drop it so the map only ever holds active backoffs.
            holder.failures.delete(cacheKey);
        };
        throwIfBackingOff();
        return initWithLock(holder.lock, () => holder.cache.get(cacheKey), async (isCurrentClaim) => {
            // Re-check under the lock: a request that entered the wait loop
            // before the failure was recorded must not immediately re-run
            // the failing migration when the lock frees up.
            throwIfBackingOff();
            const dialect = deps.createDialect(dbConfig.config);
            const db = new Kysely({ dialect, log: kyselyLogOption() });
            try {
                await enforceRuntimeMigrationPolicy(db, deps.migrationMode ?? "auto");
            }
            catch (error) {
                // Timing out behind another instance's in-flight migrations
                // is not a failure of OUR migration — the holder may just be
                // slow. Don't back off for it: the next request waits again
                // and init recovers the moment the holder finishes.
                if (!(error instanceof ConcurrentMigrationTimeoutError) &&
                    !(error instanceof PendingMigrationsError)) {
                    holder.failures.set(cacheKey, {
                        at: Date.now(),
                        message: error instanceof Error ? error.message : String(error),
                    });
                }
                // Every attempt builds a fresh dialect/pool; close it or each
                // failed init leaks its connection(s) (#1744 observed these
                // piling up as idle Postgres connections).
                await db.destroy().catch(() => { });
                throw error;
            }
            holder.failures.delete(cacheKey);
            // Note: legacy installs may carry a stray `emdash:manifest_cache`
            // row in the options table from versions that persisted a JSON
            // manifest. The runtime no longer reads or writes it. We do not
            // proactively delete it: the row is a few hundred bytes of dead
            // weight and is never on the read path, whereas a one-shot
            // cleanup-flag check costs an extra `options.get()` on every
            // isolate cold boot forever. Cheaper to leave it.
            // This returns a migrated but possibly unseeded db; create() runs
            // the seed gate and applies the seed, batched with its other init
            // reads.
            // Publish only while still the current owner: a reclaimed slow
            // init must not flip the cached Kysely identity back after the
            // reclaimer has published its own. The unpublished instance is
            // still returned and fully valid for the request that built it.
            if (isCurrentClaim()) {
                holder.cache.set(cacheKey, db);
            }
            return db;
        }, {
            deadlineMs: DB_INIT_DEADLINE_MS,
            anchor: (promise) => after(() => promise),
        });
    }
    /**
     * Get or create storage instance
     */
    static getStorage(deps) {
        const storageConfig = deps.config.storage;
        if (!storageConfig || !deps.createStorage) {
            return null;
        }
        const cacheKey = storageConfig.entrypoint;
        const cached = storageCache.get(cacheKey);
        if (cached) {
            return cached;
        }
        const storage = deps.createStorage(storageConfig.config);
        storageCache.set(cacheKey, storage);
        return storage;
    }
    /**
     * Load sandboxed plugin entries as trusted in-process plugins.
     * Used by the sandbox: false debugging escape hatch.
     *
     * Imports each plugin's bundled ESM code via a data URL, adapts it
     * with adaptSandboxEntry, and returns ResolvedPlugin objects ready
     * to be merged into the pipeline plugin list.
     */
    static async loadBypassedPlugins(entries) {
        const { adaptSandboxEntry } = await import("./plugins/adapt-sandbox-entry.js");
        const plugins = [];
        for (const entry of entries) {
            try {
                const dataUrl = `data:text/javascript;base64,${Buffer.from(entry.code).toString("base64")}`;
                // eslint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- dynamic module from trusted bundle (built by plugin-cli); adaptSandboxEntry validates required fields.
                const pluginModule = (await import(/* @vite-ignore */ dataUrl));
                const pluginDef = (pluginModule.default ?? pluginModule);
                // PluginDescriptor.storage's TypeScript type is narrower than what
                // adaptSandboxEntry actually accepts at runtime — it copies indexes
                // through to PluginStorageConfig which supports composite indexes
                // (string[][]). Pass the raw entry.storage with a structural cast
                // to preserve composite index declarations.
                // eslint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- adaptSandboxEntry copies storage through to PluginStorageConfig which supports composite indexes
                // Preserve admin metadata so plugin-management APIs can derive
                // hasAdminPages / hasDashboardWidgets correctly. Without this,
                // the admin UI hides Configure links and dashboard widgets for
                // bypassed plugins even though they declared them.
                // SandboxedPluginEntry uses looser types than PluginDescriptor
                // (label?, size: string), so coerce to the descriptor shape.
                const adminPages = entry.adminPages?.map((p) => ({
                    path: p.path,
                    label: p.label ?? p.path,
                    icon: p.icon,
                }));
                const adminWidgets = entry.adminWidgets?.map((w) => {
                    const size = w.size === "full" || w.size === "half" || w.size === "third" ? w.size : undefined;
                    return { id: w.id, title: w.title, size };
                });
                const resolved = adaptSandboxEntry(pluginDef, {
                    id: entry.id,
                    version: entry.version,
                    entrypoint: "",
                    capabilities: entry.capabilities,
                    allowedHosts: entry.allowedHosts,
                    // eslint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- adaptSandboxEntry copies storage through
                    storage: entry.storage,
                    adminPages,
                    adminWidgets,
                    settingsSchema: entry.settingsSchema,
                    portableTextBlocks: entry.portableTextBlocks,
                    fieldWidgets: entry.fieldWidgets,
                    editorPanels: entry.editorPanels,
                    editorActions: entry.editorActions,
                    mcp: entry.mcp,
                });
                plugins.push(resolved);
                console.log(`EmDash: Loaded plugin ${entry.id}:${entry.version} in-process (sandbox bypassed)`);
            }
            catch (error) {
                console.error(`EmDash: Failed to load sandboxed plugin ${entry.id} in-process:`, error);
            }
        }
        return plugins;
    }
    /**
     * Load sandboxed plugins using SandboxRunner
     */
    static async loadSandboxedPlugins(deps, db, mediaStorage, siteInfo) {
        // Check if sandboxing is enabled
        if (!deps.sandboxEnabled) {
            return sandboxedPluginCache;
        }
        // Create sandbox runner if not exists
        if (!sandboxRunner && deps.createSandboxRunner) {
            sandboxRunner = deps.createSandboxRunner(createSandboxRunnerOptions({
                db,
                beforeContentWrite: () => assertSiteWriteAllowed(db),
                taxonomyWrite: createTaxonomyAccessWithWrite(db),
                now: deps.now,
                mediaStorage: mediaStorage
                    ? {
                        upload: (opts) => mediaStorage.upload({
                            key: opts.key,
                            body: opts.body,
                            contentType: opts.contentType,
                        }),
                        download: (key) => mediaStorage.download(key),
                        delete: (key) => mediaStorage.delete(key),
                    }
                    : undefined,
            }, siteInfo));
        }
        if (!sandboxRunner) {
            return sandboxedPluginCache;
        }
        // Check if the runner is actually available (has required bindings).
        // Warn regardless of whether there are plugins to load, so operators
        // see the issue even if no marketplace plugins are installed yet.
        if (!sandboxRunner.isAvailable()) {
            const reason = sandboxRunner.unavailableReason?.();
            console.warn(reason
                ? `EmDash: Plugin sandbox is configured but not available on this platform: ${reason}. ` +
                    "Sandboxed plugins will not be loaded."
                : "EmDash: Plugin sandbox is configured but not available on this platform. " +
                    "Sandboxed plugins will not be loaded. " +
                    "If using @emdash-cms/sandbox-workerd/sandbox, ensure workerd is installed.");
            return sandboxedPluginCache;
        }
        if (deps.sandboxedPluginEntries.length === 0) {
            return sandboxedPluginCache;
        }
        // sandbox: false escape hatch is handled separately (before pipeline
        // creation) via loadBypassedPlugins. If we somehow reach here with the
        // flag set, just return — the plugins are already in the trusted pipeline.
        if (deps.sandboxBypassed) {
            return sandboxedPluginCache;
        }
        // Load each sandboxed plugin via sandbox runner
        for (const entry of deps.sandboxedPluginEntries) {
            const pluginKey = `${entry.id}:${entry.version}`;
            if (sandboxedPluginCache.has(pluginKey)) {
                continue;
            }
            try {
                const adminPages = entry.adminPages?.map((page) => ({
                    path: page.path,
                    label: page.label ?? page.path,
                    icon: page.icon,
                }));
                const adminWidgets = entry.adminWidgets?.map((widget) => ({
                    id: widget.id,
                    title: widget.title,
                    size: widget.size === "full" || widget.size === "half" || widget.size === "third"
                        ? widget.size
                        : undefined,
                }));
                warnDeprecatedPluginCapabilities(entry.id, entry.capabilities ?? []);
                const capabilities = normalizePluginCapabilities(entry.capabilities ?? []);
                // Build manifest from entry's declared config
                const manifest = {
                    id: entry.id,
                    version: entry.version,
                    capabilities,
                    allowedHosts: entry.allowedHosts ?? [],
                    storage: entry.storage ?? {},
                    // Descriptors built before hook metadata was emitted must keep
                    // working. Invoking an absent hook is a no-op in both runners.
                    hooks: entry.hooks ?? [...HOOK_NAMES],
                    routes: entry.routes ?? [],
                    admin: {
                        pages: adminPages,
                        widgets: adminWidgets,
                        settingsSchema: entry.settingsSchema,
                        portableTextBlocks: entry.portableTextBlocks,
                        fieldWidgets: entry.fieldWidgets,
                        editorPanels: entry.editorPanels,
                        editorActions: entry.editorActions,
                    },
                    mcp: entry.mcp,
                };
                const plugin = await sandboxRunner.load(manifest, entry.code);
                sandboxedPluginCache.set(pluginKey, plugin);
                sandboxedManifestCache.set(pluginKey, manifest);
                console.log(`EmDash: Loaded sandboxed plugin ${pluginKey} with capabilities: [${manifest.capabilities.join(", ")}]`);
                if (manifest.routes.length > 0) {
                    const routeMetaMap = new Map();
                    for (const routeEntry of manifest.routes) {
                        const normalized = normalizeManifestRoute(routeEntry);
                        routeMetaMap.set(normalized.name, buildRouteMeta(normalized));
                    }
                    sandboxedRouteMetaCache.set(entry.id, routeMetaMap);
                }
                else {
                    sandboxedRouteMetaCache.delete(entry.id);
                }
            }
            catch (error) {
                console.error(`EmDash: Failed to load sandboxed plugin ${entry.id}:`, error);
            }
        }
        return sandboxedPluginCache;
    }
    /**
     * Cold-start: load marketplace-installed plugins from site-local R2 storage
     *
     * Queries _plugin_state for source='marketplace' rows, fetches each bundle
     * from R2, and loads via SandboxRunner.
     */
    /**
     * Cold-start load of all active sandboxed plugins for one install
     * tier (marketplace or registry) from site-local R2.
     *
     * Mirrors {@link syncSandboxedSourcePlugins} but runs once at runtime
     * creation, before request traffic arrives; the sync method runs on
     * demand after install / update / uninstall handlers.
     */
    static async loadInstalledSandboxedPlugins(source, db, storage, deps, cache, siteInfo) {
        // Ensure sandbox runner exists with media storage wired up.
        // (storage here is the media Storage adapter from the runtime.)
        if (!sandboxRunner && deps.createSandboxRunner) {
            sandboxRunner = deps.createSandboxRunner(createSandboxRunnerOptions({
                db,
                beforeContentWrite: () => assertSiteWriteAllowed(db),
                taxonomyWrite: createTaxonomyAccessWithWrite(db),
                now: deps.now,
                mediaStorage: {
                    upload: (opts) => storage.upload({
                        key: opts.key,
                        body: opts.body,
                        contentType: opts.contentType,
                    }),
                    download: (key) => storage.download(key),
                    delete: (key) => storage.delete(key),
                },
            }, siteInfo));
        }
        // In sandbox bypass mode, marketplace plugins are loaded in-process
        // BEFORE pipeline creation by EmDashRuntime.create(). Skip here.
        if (deps.sandboxBypassed)
            return;
        if (!sandboxRunner || !sandboxRunner.isAvailable()) {
            return;
        }
        const keySet = source === "marketplace" ? marketplacePluginKeys : registryPluginKeys;
        try {
            const stateRepo = new PluginStateRepository(db);
            const plugins = source === "marketplace"
                ? await stateRepo.getMarketplacePlugins()
                : await stateRepo.getRegistryPlugins();
            for (const plugin of plugins) {
                if (plugin.status !== "active")
                    continue;
                // Marketplace plugins record the live version in
                // `marketplaceVersion`; registry plugins use `version` directly.
                const version = source === "marketplace" ? (plugin.marketplaceVersion ?? plugin.version) : plugin.version;
                const pluginKey = `${plugin.pluginId}:${version}`;
                // Skip if already loaded (shouldn't happen, but guard)
                if (cache.has(pluginKey))
                    continue;
                try {
                    const bundle = await loadBundleFromR2(storage, plugin.pluginId, version, source);
                    if (!bundle) {
                        console.warn(`EmDash: ${source} plugin ${plugin.pluginId}@${version} not found in R2`);
                        continue;
                    }
                    const loaded = await sandboxRunner.load(bundle.manifest, bundle.backendCode);
                    cache.set(pluginKey, loaded);
                    sandboxedManifestCache.set(pluginKey, bundle.manifest);
                    keySet.add(pluginKey);
                    // Cache manifest admin config for getManifest()
                    marketplaceManifestCache.set(plugin.pluginId, {
                        id: bundle.manifest.id,
                        version: bundle.manifest.version,
                        admin: bundle.manifest.admin,
                        mcp: bundle.manifest.mcp,
                        storage: bundle.manifest.storage,
                        allowedHosts: bundle.manifest.allowedHosts,
                        capabilities: bundle.manifest.capabilities,
                    });
                    // Cache route metadata from manifest for auth decisions
                    if (bundle.manifest.routes.length > 0) {
                        const routeMeta = new Map();
                        for (const entry of bundle.manifest.routes) {
                            const normalized = normalizeManifestRoute(entry);
                            routeMeta.set(normalized.name, buildRouteMeta(normalized));
                        }
                        sandboxedRouteMetaCache.set(plugin.pluginId, routeMeta);
                    }
                    console.log(`EmDash: Loaded ${source} plugin ${pluginKey} with capabilities: [${bundle.manifest.capabilities.join(", ")}]`);
                }
                catch (error) {
                    console.error(`EmDash: Failed to load ${source} plugin ${plugin.pluginId}:`, error);
                }
            }
        }
        catch {
            // _plugin_state table may not exist yet (pre-migration)
        }
    }
    /**
     * Cold-start: load marketplace plugins in bypass mode (sandbox: false).
     *
     * Each active marketplace bundle is read, evaluated via data URL, adapted
     * with adaptSandboxEntry, and returned as a ResolvedPlugin. The caller is
     * responsible for merging these into allPipelinePlugins / configuredPlugins
     * BEFORE the hook pipeline is created, so hooks and routes register in
     * the trusted pipeline.
     *
     * Also caches manifest and route metadata so admin UI / getManifest() work.
     *
     * Returns ResolvedPlugins to be merged into the pipeline.
     */
    static async loadMarketplacePluginsBypassed(db, storage) {
        const resolved = [];
        try {
            const stateRepo = new PluginStateRepository(db);
            const marketplacePlugins = await stateRepo.getMarketplacePlugins();
            if (marketplacePlugins.length === 0)
                return resolved;
            console.info("EmDash: Sandbox disabled (sandbox: false). " +
                "Marketplace plugins will run in-process without isolation.");
            const { adaptSandboxEntry } = await import("./plugins/adapt-sandbox-entry.js");
            for (const plugin of marketplacePlugins) {
                if (plugin.status !== "active")
                    continue;
                const version = plugin.marketplaceVersion ?? plugin.version;
                try {
                    const bundle = await loadBundleFromR2(storage, plugin.pluginId, version);
                    if (!bundle) {
                        console.warn(`EmDash: Marketplace plugin ${plugin.pluginId}@${version} not found in R2`);
                        continue;
                    }
                    // Cache manifest and route metadata for admin UI and route auth
                    marketplaceManifestCache.set(plugin.pluginId, {
                        id: bundle.manifest.id,
                        version: bundle.manifest.version,
                        admin: bundle.manifest.admin,
                        mcp: bundle.manifest.mcp,
                        storage: bundle.manifest.storage,
                        allowedHosts: bundle.manifest.allowedHosts,
                        capabilities: bundle.manifest.capabilities,
                    });
                    if (bundle.manifest.routes.length > 0) {
                        const routeMeta = new Map();
                        for (const entry of bundle.manifest.routes) {
                            const normalized = normalizeManifestRoute(entry);
                            routeMeta.set(normalized.name, buildRouteMeta(normalized));
                        }
                        sandboxedRouteMetaCache.set(plugin.pluginId, routeMeta);
                    }
                    // Evaluate the bundled ESM and adapt it as a trusted plugin
                    const dataUrl = `data:text/javascript;base64,${Buffer.from(bundle.backendCode).toString("base64")}`;
                    // eslint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- dynamic module from trusted bundle (built by plugin-cli); adaptSandboxEntry validates required fields.
                    const pluginModule = (await import(/* @vite-ignore */ dataUrl));
                    const pluginDef = (pluginModule.default ?? pluginModule);
                    const adapted = adaptSandboxEntry(pluginDef, {
                        id: bundle.manifest.id,
                        version: bundle.manifest.version,
                        entrypoint: "",
                        capabilities: bundle.manifest.capabilities ?? [],
                        allowedHosts: bundle.manifest.allowedHosts ?? [],
                        // eslint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- adaptSandboxEntry copies storage through
                        storage: (bundle.manifest.storage ?? {}),
                        adminPages: bundle.manifest.admin?.pages,
                        adminWidgets: bundle.manifest.admin?.widgets?.map((w) => ({
                            id: w.id,
                            title: w.title,
                            size: w.size === "full" || w.size === "half" || w.size === "third" ? w.size : undefined,
                        })),
                        settingsSchema: bundle.manifest.admin?.settingsSchema,
                        editorPanels: bundle.manifest.admin?.editorPanels,
                        editorActions: bundle.manifest.admin?.editorActions,
                        mcp: bundle.manifest.mcp,
                    });
                    resolved.push(adapted);
                    console.log(`EmDash: Loaded marketplace plugin ${plugin.pluginId}@${version} in-process (sandbox bypassed)`);
                }
                catch (error) {
                    console.error(`EmDash: Failed to load marketplace plugin ${plugin.pluginId} in-process:`, error);
                }
            }
        }
        catch {
            // _plugin_state table may not exist yet
        }
        return resolved;
    }
    /**
     * Resolve exclusive hook selections on startup.
     *
     * Delegates to the shared resolveExclusiveHooks() in hooks.ts.
     * The runtime version considers all pipeline providers as "active" since
     * the pipeline was already built from only active/enabled plugins.
     */
    static async resolveExclusiveHooks(pipeline, db, deps) {
        const exclusiveHookNames = pipeline.getRegisteredExclusiveHooks();
        if (exclusiveHookNames.length === 0)
            return;
        let optionsRepo;
        try {
            optionsRepo = new OptionsRepository(db);
        }
        catch {
            return; // Options table may not exist yet
        }
        // Build preferred hints from sandboxed plugin entries
        const preferredHints = new Map();
        for (const entry of deps.sandboxedPluginEntries) {
            if (entry.preferred && entry.preferred.length > 0) {
                preferredHints.set(entry.id, entry.preferred);
            }
        }
        // The pipeline was created from only enabled plugins, so all providers
        // in it are active. The isActive check always returns true.
        await resolveExclusiveHooksShared({
            pipeline,
            isActive: () => true,
            getOption: (key) => optionsRepo.get(key),
            getOptions: (keys) => optionsRepo.getMany(keys),
            setOption: (key, value) => optionsRepo.set(key, value),
            deleteOption: async (key) => {
                await optionsRepo.delete(key);
            },
            preferredHints,
            fallbackProviders: new Set([DEFAULT_COMMENT_MODERATOR_PLUGIN_ID]),
        });
    }
    // =========================================================================
    // Manifest
    // =========================================================================
    /**
     * Build the admin manifest from the live database.
     *
     * Used by the admin UI (sidebar collections, content editor field
     * dispatch, manifest endpoint) and by WordPress import — it's never
     * read on a public request, so this isn't on any anonymous hot path.
     *
     * No cross-request cache. The previous worker-isolate cache produced
     * a class of cross-isolate staleness bugs (#776, #873, #876, #877)
     * because Cloudflare Workers keeps multiple warm isolates per region
     * and there's no fan-out primitive to invalidate them in step. The
     * cache existed to amortize an N+1 schema query pattern; now that
     * `listCollectionsWithFields()` does the same work in two queries,
     * the rebuild is fast enough to pay on every admin request.
     *
     * Within a single request, `requestCached` deduplicates concurrent
     * callers (the manifest endpoint and an admin SSR template, say).
     */
    getManifest() {
        return requestCached("emdash:manifest", () => this._buildManifest());
    }
    /**
     * Build the manifest from the database.
     *
     * Constant query shapes via `listCollectionsWithFields()` — one query
     * for collections, one batched query for fields (chunked at
     * `SQL_BATCH_SIZE` collection IDs to stay under D1's bound-parameter
     * limit). Typical sites stay well under the chunk threshold, so this
     * is two queries in practice; never N+1.
     */
    async _buildManifest() {
        // Build collections from the live database.
        // Use this.db (ALS-aware getter) so playground mode picks up the
        // per-session DO database instead of the hardcoded singleton.
        const manifestCollections = await buildManifestCollections({}, this.db);
        // Build plugins manifest
        const manifestPlugins = {};
        for (const plugin of this.configuredPlugins) {
            const status = this.pluginStates.get(plugin.id);
            const enabled = status === undefined || status === "active";
            // Determine admin mode: has admin entry → react, has pages/widgets → blocks, else none
            const hasAdminEntry = !!plugin.admin?.entry;
            const hasAdminPages = (plugin.admin?.pages?.length ?? 0) > 0;
            const hasWidgets = (plugin.admin?.widgets?.length ?? 0) > 0;
            const hasEditorExtensions = (plugin.admin?.editorPanels?.length ?? 0) > 0 ||
                (plugin.admin?.editorActions?.length ?? 0) > 0;
            let adminMode = "none";
            if (hasAdminEntry) {
                adminMode = "react";
            }
            else if (hasAdminPages || hasWidgets || hasEditorExtensions) {
                adminMode = "blocks";
            }
            manifestPlugins[plugin.id] = {
                version: plugin.version,
                enabled,
                adminMode,
                adminPages: plugin.admin?.pages ?? [],
                dashboardWidgets: plugin.admin?.widgets ?? [],
                portableTextBlocks: plugin.admin?.portableTextBlocks,
                fieldWidgets: plugin.admin?.fieldWidgets,
                editorPanels: plugin.admin?.editorPanels,
                editorActions: plugin.admin?.editorActions,
            };
        }
        // Add sandboxed plugins (use entries for admin config)
        for (const entry of this.sandboxedPluginEntries) {
            const status = this.pluginStates.get(entry.id);
            const enabled = status === undefined || status === "active";
            const hasAdminPages = (entry.adminPages?.length ?? 0) > 0;
            const hasWidgets = (entry.adminWidgets?.length ?? 0) > 0;
            const hasEditorExtensions = (entry.editorPanels?.length ?? 0) > 0 || (entry.editorActions?.length ?? 0) > 0;
            manifestPlugins[entry.id] = {
                version: entry.version,
                enabled,
                sandboxed: true,
                // `adminMode` reflects only admin pages/widgets. A plugin can
                // contribute portableTextBlocks/fieldWidgets with adminMode "none" —
                // the admin reads those from the manifest regardless, so don't gate
                // admin contributions on `adminMode`.
                adminMode: hasAdminPages || hasWidgets || hasEditorExtensions ? "blocks" : "none",
                adminPages: entry.adminPages ?? [],
                dashboardWidgets: entry.adminWidgets ?? [],
                portableTextBlocks: entry.portableTextBlocks,
                fieldWidgets: entry.fieldWidgets,
                editorPanels: entry.editorPanels,
                editorActions: entry.editorActions,
            };
        }
        // Add marketplace-installed plugins (dynamically loaded from R2)
        for (const [pluginId, meta] of marketplaceManifestCache) {
            // Skip if already included from build-time config
            if (manifestPlugins[pluginId])
                continue;
            const status = this.pluginStates.get(pluginId);
            const enabled = status === "active";
            const pages = meta.admin?.pages;
            const widgets = meta.admin?.widgets;
            const hasAdminPages = (pages?.length ?? 0) > 0;
            const hasWidgets = (widgets?.length ?? 0) > 0;
            const hasEditorExtensions = (meta.admin?.editorPanels?.length ?? 0) > 0 || (meta.admin?.editorActions?.length ?? 0) > 0;
            manifestPlugins[pluginId] = {
                version: meta.version,
                enabled,
                sandboxed: true,
                adminMode: hasAdminPages || hasWidgets || hasEditorExtensions ? "blocks" : "none",
                adminPages: pages ?? [],
                dashboardWidgets: widgets ?? [],
                editorPanels: meta.admin?.editorPanels,
                editorActions: meta.admin?.editorActions,
            };
        }
        // Build taxonomies from database
        let manifestTaxonomies = [];
        let taxonomyDefinitionLocales = [];
        try {
            const rows = await selectTaxonomyDefs(this.db).orderBy("d.name").execute();
            taxonomyDefinitionLocales = rows.map((row) => row.locale);
            manifestTaxonomies = rows.map((row) => ({
                id: row.id,
                name: row.name,
                label: row.label,
                labelSingular: row.label_singular ?? undefined,
                hierarchical: row.hierarchical === 1,
                collections: parseStringArray(row.collections).toSorted(),
                locale: row.locale,
                translationGroup: row.translation_group ?? row.id,
            }));
        }
        catch (error) {
            console.debug("EmDash: Could not load taxonomy definitions:", error);
        }
        try {
            const configuredLocales = virtualConfig?.i18n?.locales ?? getI18nConfig()?.locales ?? [];
            await warnAboutUnconfiguredTaxonomyLocales(this.db, configuredLocales, taxonomyDefinitionLocales);
        }
        catch (error) {
            console.warn("[i18n] taxonomy locale diagnostic failed:", error);
        }
        // Build manifest hash
        const manifestHash = await hashString(JSON.stringify(manifestCollections) +
            JSON.stringify(manifestPlugins) +
            JSON.stringify(manifestTaxonomies));
        // Determine auth mode
        const authMode = getAuthMode(this.config);
        const authModeValue = authMode.type === "external" ? authMode.providerType : "passkey";
        // Include i18n config if enabled (read from virtual module to avoid SSR module singleton mismatch)
        const i18nConfig = virtualConfig?.i18n ?? getI18nConfig();
        const i18n = i18nConfig && i18nConfig.locales && i18nConfig.locales.length > 1
            ? {
                defaultLocale: i18nConfig.defaultLocale,
                locales: i18nConfig.locales,
                prefixDefaultLocale: i18nConfig.prefixDefaultLocale,
            }
            : undefined;
        const { registry, error: registryConfigurationError } = resolveManifestRegistryConfig(getRegistryConfigInput(this.config.registry));
        if (registryConfigurationError) {
            console.error(`EmDash registry configuration error in ${registryConfigurationError.field} (${registryConfigurationError.code})`);
        }
        return {
            version: VERSION,
            commit: COMMIT,
            astroVersion: this.config.astroVersion,
            hash: manifestHash,
            collections: manifestCollections,
            plugins: manifestPlugins,
            taxonomies: manifestTaxonomies,
            authMode: authModeValue,
            i18n,
            contentLocale: {
                defaultLocale: i18nConfig?.defaultLocale ?? "en",
                implicit: i18nConfig === null,
            },
            marketplace: !!this.config.marketplace,
            sandboxEnabled: this.runtimeDeps.sandboxEnabled && this.runtimeDeps.sandboxBypassed !== true,
            registry,
            registryConfigurationError,
        };
    }
    /**
     * Verify and repair FTS indexes on demand. Runs at most once per worker
     * lifetime.
     *
     * Originally called from `EmDashRuntime.create()`, but on a busy D1 link
     * (e.g. SIN replica ~80-150ms per query) it added ~1.5s to every cold
     * start for a modest-sized site — more than every other init phase
     * combined. Anonymous public reads never touch the search write path,
     * so the cost isn't paid back for the vast majority of requests.
     *
     * Instead, search endpoints call this lazily: the first request that
     * actually needs the index pays the verify cost (usually fast — no
     * rebuild needed), everyone else runs cold-free.
     *
     * Uses the runtime's singleton database (`this._db`) rather than the
     * request-scoped DB. Verify reads only, but `rebuildIndex` writes, and
     * a GET search request on D1 carries a `first-unconstrained` session
     * that's free to route at a read replica — unsafe for writes. The
     * singleton always goes through the default binding, which the D1
     * adapter will promote to `first-primary` for write statements.
     *
     * Safe to call concurrently: repeated callers share the same in-flight
     * promise. Errors are swallowed internally so callers don't need to
     * defend against FTS not existing yet (pre-setup).
     */
    async ensureSearchHealthy() {
        // Non-SQLite has no FTS to verify; the check is a cheap synchronous
        // branch, no need to cache it.
        if (!isSqlite(this._db))
            return;
        try {
            await singleFlightCached(this._searchHealthCache, async () => {
                try {
                    const ftsManager = new FTSManager(this._db);
                    const repaired = await ftsManager.verifyAndRepairAll();
                    if (repaired > 0) {
                        console.log(`Repaired ${repaired} corrupted FTS index(es)`);
                    }
                }
                catch {
                    // FTS tables may not exist yet (pre-setup). Non-fatal — cache
                    // the "checked" state regardless so we don't re-scan.
                }
            }, { anchor: (promise) => after(() => promise), ownerTimeoutMs: 30_000 });
        }
        catch {
            // This check is best-effort and must never fail the calling request.
            // The inner body already swallows verify errors; this guards the
            // outer failure modes (owner timeout, waiter give-up) so a slow FTS
            // scan degrades to "unverified", not a 500 on admin/search routes.
        }
    }
    // =========================================================================
    // Content Handlers
    // =========================================================================
    async handleContentList(collection, params) {
        return handleContentList(this.db, collection, params);
    }
    async handleContentAuthors(collection) {
        return handleContentAuthors(this.db, collection);
    }
    async handleContentGet(collection, id, locale, referenceOptions) {
        const result = await handleContentGet(this.db, collection, id, locale, referenceOptions);
        return this.hydrateDraftData(result);
    }
    async handleContentGetIncludingTrashed(collection, id, locale) {
        const result = await handleContentGetIncludingTrashed(this.db, collection, id, locale);
        return this.hydrateDraftData(result);
    }
    /**
     * If the response item has a `draftRevisionId`, replace `item.data` with
     * the draft revision's data and expose the original published values as
     * `liveData`. This makes the content_get / content_update round-trip
     * intuitive — read returns the latest content the caller has saved
     * (their pending draft), with the previously-published values still
     * accessible for compare-style flows.
     *
     * No-op when no draft exists or the response is an error.
     */
    async hydrateDraftData(result, options = {}) {
        if (!result || typeof result !== "object")
            return result;
        // eslint-disable-next-line typescript/no-unsafe-type-assertion -- shape probed below
        const r = result;
        if (!r.success || !r.data?.item)
            return result;
        const item = r.data.item;
        const draftRevisionId = typeof item.draftRevisionId === "string" ? item.draftRevisionId : null;
        if (!draftRevisionId)
            return result;
        try {
            const revision = await new RevisionRepository(this.db).findById(draftRevisionId);
            if (!revision) {
                if (options.strict)
                    throw new Error(`Draft revision not found: ${draftRevisionId}`);
                return result;
            }
            const liveData = item.data && typeof item.data === "object"
                ? // eslint-disable-next-line typescript/no-unsafe-type-assertion -- narrowed to object above
                    item.data
                : {};
            // Strip leading-underscore keys (`_slug`, `_rev`, etc.) from the
            // revision data — those are handler-internal markers and don't
            // belong in the surfaced `data` field. Match syncDataColumns at
            // content.ts:~1119.
            const revisionData = {};
            for (const [key, value] of Object.entries(revision.data)) {
                if (!key.startsWith("_"))
                    revisionData[key] = value;
            }
            const mergedData = { ...liveData, ...revisionData };
            // Return a clone rather than mutating in place. The response
            // object isn't retained by the runtime today, but a future
            // request-cache layer would observe stale-after-mutation bugs;
            // cloning closes that footgun.
            // `r.data` was narrowed to `{ item?: ... }` at the top of this
            // method; spread its other keys (e.g. `_rev`) alongside the
            // hydrated item without going back through `unknown`.
            return {
                ...result,
                // eslint-disable-next-line typescript/no-unsafe-type-assertion -- shape preserved; result has been narrowed to the {success,data:{item}} envelope
                data: {
                    ...r.data,
                    item: {
                        ...item,
                        ...(options.includeStagedSlug && typeof revision.data._slug === "string"
                            ? { slug: revision.data._slug }
                            : {}),
                        data: mergedData,
                        liveData,
                    },
                },
            };
        }
        catch (error) {
            if (options.strict)
                throw error;
            // Non-fatal — fall back to the unhydrated response. Log so the
            // failure isn't completely silent (the response will look stale
            // to the caller but no error is raised).
            console.error("[emdash] draft hydration failed:", error);
            return result;
        }
    }
    async handleContentCreate(collection, body, options = {}) {
        const actor = body.actor ? { ...body.actor } : undefined;
        let locale;
        try {
            locale = resolveContentCreateLocale(body.locale);
        }
        catch (error) {
            return {
                success: false,
                error: {
                    code: "VALIDATION_ERROR",
                    message: error instanceof Error ? error.message : "Invalid locale",
                },
            };
        }
        let translationSource = null;
        let sharedFieldSlugs = [];
        if (body.translationOf) {
            const repo = new ContentRepository(this.db);
            const source = await repo.findById(collection, body.translationOf);
            if (!source) {
                return {
                    success: false,
                    error: { code: "NOT_FOUND", message: "Translation source content not found" },
                };
            }
            translationSource = source;
            sharedFieldSlugs = (await this.db
                .selectFrom("_emdash_fields as field")
                .innerJoin("_emdash_collections as collection", "collection.id", "field.collection_id")
                .select(["field.slug", "field.type", "field.validation"])
                .where("collection.slug", "=", collection)
                .where("field.translatable", "=", 0)
                .execute())
                // A storage-less field has nothing in `data` worth sharing: its
                // selection is keyed by translation group, so every translation
                // already reads the same edges. What the source row does carry under
                // that slug is the frozen column a field bound after the fact left
                // behind, and copying it would send a key `data` no longer accepts.
                .filter((field) => !isStoragelessFieldRow(field))
                .map((field) => field.slug);
            const siblings = await repo.findTranslations(collection, source.translationGroup ?? source.id);
            if (siblings.some((sibling) => sibling.locale?.toLowerCase() === locale.toLowerCase())) {
                return {
                    success: false,
                    error: {
                        code: "CONFLICT",
                        message: `Translation already exists in locale "${locale}" for this content item`,
                    },
                };
            }
        }
        const saveHookDetails = {
            locale,
            ...(body.translationOf ? { translationOf: body.translationOf } : {}),
        };
        // Run beforeSave hooks (trusted plugins)
        let processedData = body.data;
        if (!options.skipSaveHooks && this.hooks.hasHooks("content:beforeSave")) {
            try {
                const hookResult = await this.hooks.runContentBeforeSave(body.data, collection, true, undefined, actor, saveHookDetails);
                processedData = hookResult.content;
            }
            catch (error) {
                return beforeSaveFailure(error);
            }
        }
        if (translationSource) {
            processedData = { ...processedData };
            for (const slug of sharedFieldSlugs) {
                if (Object.hasOwn(translationSource.data, slug)) {
                    processedData[slug] = translationSource.data[slug];
                }
                else {
                    delete processedData[slug];
                }
            }
        }
        const collectionInfo = await this.schemaRegistry
            .getCollectionWithFields(collection)
            .catch(() => null);
        const resolvedBlockTypes = collectionInfo?.fields.some((field) => field.type === "blocks")
            ? await resolveBlockTypes(this.db)
            : undefined;
        if (collectionInfo) {
            try {
                processedData = await normalizeBlocksData(this.db, collectionInfo, processedData, translationSource?.data, {
                    migrateBlocks: body.migrateBlocks,
                    replaceBlocks: body.replaceBlocks,
                }, false, resolvedBlockTypes);
            }
            catch (error) {
                if (error instanceof SchemaError) {
                    return {
                        success: false,
                        error: { code: error.code, message: error.message, details: error.details },
                    };
                }
                throw error;
            }
        }
        processedData = await this.normalizeFieldValues(collection, processedData, collectionInfo, resolvedBlockTypes);
        // Validate against the collection schema. Hook output is validated
        // rather than `body.data` so plugins that mutate field values can't
        // sneak invalid data past.
        const { validateContentData } = await import("./api/handlers/validation.js");
        const validation = await validateContentData(this.db, collection, processedData, {
            partial: false,
        });
        if (!validation.ok) {
            return {
                success: false,
                error: validation.error,
            };
        }
        // Create the content
        const { actor: _discardedActor, migrateBlocks: _discardedMigrateBlocks, replaceBlocks: _discardedReplaceBlocks, ...contentBody } = body;
        const result = await handleContentCreate(this.db, collection, {
            ...contentBody,
            data: processedData,
            locale,
            authorId: body.authorId,
            bylines: body.bylines,
        });
        if (result.success && result.data) {
            await this.refreshContentUsageAfterSuccessfulWrite(collection, [result.data.item.id]);
        }
        // Run afterSave hooks (fire-and-forget)
        if (!options.skipSaveHooks && result.success && result.data) {
            this.runAfterSaveHooks(contentItemToRecord(result.data.item), collection, true, actor, options.excludeAfterSavePluginId, { ...saveHookDetails, locale: result.data.item.locale ?? locale });
        }
        return result;
    }
    async handleContentUpdate(collection, id, body) {
        const actor = body.actor ? { ...body.actor } : undefined;
        // Resolve slug → ID if needed (before any lookups)
        const repo = new ContentRepository(this.db);
        const resolvedItem = await repo.findByIdOrSlug(collection, id, body.locale);
        const resolvedId = resolvedItem?.id ?? id;
        // Validate _rev early — before draft revision writes which modify updated_at.
        // After validation, strip _rev so the handler doesn't double-check against
        // the now-modified timestamp.
        if (body._rev) {
            if (!resolvedItem) {
                return {
                    success: false,
                    error: { code: "NOT_FOUND", message: `Content item not found: ${id}` },
                };
            }
            const revCheck = validateRev(body._rev, resolvedItem);
            if (!revCheck.valid) {
                return {
                    success: false,
                    error: { code: "CONFLICT", message: revCheck.message },
                };
            }
        }
        const { _rev: _discardedRev, actor: _discardedActor, migrateBlocks, replaceBlocks, ...bodyWithoutRev } = body;
        const blockWriteOptions = { migrateBlocks, replaceBlocks };
        // Loaded once and threaded through normalization, the stale-key drop and the draft
        // merge below: each of those needs the field list and the registry does not cache.
        // A save carrying only a reference selection reaches the draft merge without any
        // data, so it needs the collection loaded just the same.
        const collectionInfo = bodyWithoutRev.data || bodyWithoutRev.references
            ? await this.schemaRegistry.getCollectionWithFields(collection).catch(() => null)
            : null;
        const knownFieldSlugs = new Set((collectionInfo?.fields ?? []).map((f) => f.slug));
        // A collection that keeps drafts merges `data` into a revision instead of
        // writing columns, so a reference field's slug would land in the revision
        // JSON and never reach the check the column writer's own path makes. Both
        // operands are already in hand here, so the check costs nothing.
        if (bodyWithoutRev.data && collectionInfo) {
            const storageless = new Set(collectionInfo.fields.filter(isStoragelessField).map((field) => field.slug));
            const changed = changedStoragelessDataKeys(storageless, bodyWithoutRev.data, resolvedItem?.data ?? {});
            if (changed.length > 0)
                return storagelessDataKeyError(changed);
        }
        // Run beforeSave hooks if data is provided
        let processedData = bodyWithoutRev.data;
        let resolvedBlockTypes;
        if (bodyWithoutRev.data) {
            if (this.hooks.hasHooks("content:beforeSave")) {
                try {
                    const hookResult = await this.hooks.runContentBeforeSave(bodyWithoutRev.data, collection, false, resolvedItem?.id, actor, resolvedItem?.locale ? { locale: resolvedItem.locale } : {});
                    processedData = hookResult.content;
                }
                catch (error) {
                    return beforeSaveFailure(error);
                }
            }
            processedData = await this.normalizeFieldValues(collection, processedData, collectionInfo, undefined, false);
            // Drop unknown field keys the entry already stores (e.g. a deleted field
            // stranded in a draft revision) before validation, while still rejecting
            // unknown keys the entry has never stored.
            if (collectionInfo?.fields) {
                processedData = await this.dropUnknownKeysAlreadyStored(processedData, resolvedItem, knownFieldSlugs);
            }
            if (collectionInfo?.fields.some((field) => field.type === "blocks" && Object.hasOwn(processedData, field.slug))) {
                resolvedBlockTypes = await resolveBlockTypes(this.db);
            }
            if (!collectionInfo?.supports?.includes("revisions")) {
                if (collectionInfo) {
                    try {
                        processedData = await normalizeBlocksData(this.db, collectionInfo, processedData, resolvedItem?.data, blockWriteOptions, true, resolvedBlockTypes);
                        processedData = await this.normalizeFieldValues(collection, processedData, collectionInfo, resolvedBlockTypes);
                    }
                    catch (error) {
                        if (error instanceof SchemaError) {
                            return {
                                success: false,
                                error: { code: error.code, message: error.message, details: error.details },
                            };
                        }
                        throw error;
                    }
                }
                const { validateContentData } = await import("./api/handlers/validation.js");
                const validation = await validateContentData(this.db, collection, processedData, {
                    partial: true,
                });
                if (!validation.ok) {
                    return {
                        success: false,
                        error: validation.error,
                    };
                }
            }
        }
        // Draft-aware revision handling (if collection supports revisions)
        // Content table columns = published data (never written by saves).
        // Draft data lives only in the revisions table.
        let usesDraftRevisions = false;
        let draftStorageChanged = false;
        if (processedData || bodyWithoutRev.references) {
            if (collectionInfo?.supports?.includes("revisions")) {
                usesDraftRevisions = true;
                // Resolve a pending selection to translation groups before it is
                // staged, so a bad id or an over-long selection fails this save the
                // way a direct link write would, and publication has nothing left to
                // resolve.
                let stagedReferences;
                let stagedReferenceBaselines;
                if (bodyWithoutRev.references) {
                    stagedReferences = {};
                    let entryGroup;
                    for (const [fieldSlug, selectedIds] of Object.entries(bodyWithoutRev.references)) {
                        const resolved = await resolveReferenceSelection(this.db, collection, resolvedId, fieldSlug, selectedIds);
                        if (!resolved.success) {
                            return { success: false, error: resolved.error };
                        }
                        stagedReferences[fieldSlug] = resolved.data.groups;
                        entryGroup = resolved.data.entryGroup;
                    }
                    if (entryGroup) {
                        const liveSelection = await liveReferenceSelection(this.db, collection, entryGroup);
                        stagedReferenceBaselines = {};
                        for (const fieldSlug of Object.keys(stagedReferences)) {
                            stagedReferenceBaselines[fieldSlug] = liveSelection[fieldSlug] ?? [];
                        }
                    }
                }
                const revisionRepo = new RevisionRepository(this.db);
                let existing = await repo.findById(collection, resolvedId);
                for (let attempt = 0; existing && attempt < MAX_DRAFT_STAGE_ATTEMPTS; attempt++) {
                    let baseData;
                    if (existing.draftRevisionId) {
                        const draftRevision = await revisionRepo.findById(existing.draftRevisionId);
                        baseData = draftRevision?.data ?? existing.data;
                    }
                    else {
                        baseData = existing.data;
                    }
                    let attemptData = processedData ?? {};
                    try {
                        attemptData = await normalizeBlocksData(this.db, collectionInfo, attemptData, baseData, blockWriteOptions, true, resolvedBlockTypes);
                        attemptData = await this.normalizeFieldValues(collection, attemptData, collectionInfo, resolvedBlockTypes);
                    }
                    catch (error) {
                        if (error instanceof SchemaError) {
                            return {
                                success: false,
                                error: { code: error.code, message: error.message, details: error.details },
                            };
                        }
                        throw error;
                    }
                    const { validateContentData } = await import("./api/handlers/validation.js");
                    const validation = await validateContentData(this.db, collection, attemptData, {
                        partial: true,
                    });
                    if (!validation.ok) {
                        return { success: false, error: validation.error };
                    }
                    // Written without the keys the collection has no field for, so an entry
                    // carrying a deleted field's value sheds it on its next save instead of
                    // carrying it through every revision that follows.
                    const mergedData = collectionInfo?.fields
                        ? keepKnownFields({ ...baseData, ...attemptData }, knownFieldSlugs)
                        : { ...baseData, ...attemptData };
                    if (bodyWithoutRev.slug !== undefined) {
                        mergedData._slug = bodyWithoutRev.slug;
                    }
                    if (stagedReferences) {
                        mergedData[STAGED_REFERENCES_KEY] = mergeStagedReferences(baseData, stagedReferences);
                    }
                    if (stagedReferenceBaselines) {
                        mergedData[STAGED_REFERENCES_BASELINE_KEY] = mergeStagedReferenceBaselines(baseData, stagedReferenceBaselines);
                    }
                    const revision = await revisionRepo.create({
                        collection,
                        entryId: resolvedId,
                        data: mergedData,
                        authorId: actor?.id,
                    });
                    let staged;
                    try {
                        staged = await repo.replaceDraftRevision(collection, resolvedId, revision.id, existing);
                    }
                    catch (error) {
                        try {
                            await revisionRepo.deleteIfUnreferenced(collection, resolvedId, revision.id);
                        }
                        catch (cleanupError) {
                            console.error(`[emdash] Failed to clean up unstaged revision ${revision.id}:`, cleanupError);
                        }
                        throw error;
                    }
                    if (!staged) {
                        try {
                            await revisionRepo.deleteIfUnreferenced(collection, resolvedId, revision.id);
                        }
                        catch (cleanupError) {
                            console.error(`[emdash] Failed to clean up unstaged revision ${revision.id}:`, cleanupError);
                        }
                        if (body._rev || attempt === MAX_DRAFT_STAGE_ATTEMPTS - 1) {
                            const error = new ContentMutationConflictError();
                            return {
                                success: false,
                                error: { code: "CONFLICT", message: error.message },
                            };
                        }
                        existing = await repo.findById(collection, resolvedId);
                        continue;
                    }
                    draftStorageChanged = true;
                    processedData = attemptData;
                    if (bodyWithoutRev.skipRevision && existing.draftRevisionId) {
                        try {
                            await revisionRepo.deleteIfUnreferenced(collection, resolvedId, existing.draftRevisionId);
                        }
                        catch (error) {
                            console.error(`[emdash] Failed to clean up superseded revision ${existing.draftRevisionId}:`, error);
                        }
                    }
                    else {
                        after(async () => {
                            try {
                                await revisionRepo.pruneQueuedEntry(collection, resolvedId, revision.id, 50);
                            }
                            catch (error) {
                                console.error(`[revisions] Failed to prune revisions for ${collection}/${resolvedId}:`, error);
                            }
                        });
                    }
                    break;
                }
            }
        }
        // Public HTML comes from live columns / SEO / taxonomies, not draft revisions.
        const liveMetaTouched = Object.entries(bodyWithoutRev).some(([key, value]) => value !== undefined && !DRAFT_ONLY_UPDATE_KEYS.has(key));
        // Update the content table:
        // - If collection uses draft revisions: only update metadata (no data fields, no slug)
        // - Otherwise: update everything as before
        const result = usesDraftRevisions && !liveMetaTouched
            ? await handleContentGet(this.db, collection, resolvedId)
            : await handleContentUpdate(this.db, collection, resolvedId, {
                ...bodyWithoutRev,
                data: usesDraftRevisions ? undefined : processedData,
                slug: usesDraftRevisions ? undefined : bodyWithoutRev.slug,
                references: usesDraftRevisions ? undefined : bodyWithoutRev.references,
                authorId: bodyWithoutRev.authorId,
                bylines: bodyWithoutRev.bylines,
            });
        const liveContentChanged = usesDraftRevisions
            ? liveMetaTouched
            : Boolean(processedData ||
                bodyWithoutRev.slug !== undefined ||
                bodyWithoutRev.references ||
                liveMetaTouched);
        // Hydrate draft data BEFORE firing afterSave hooks so the hook sees
        // the same effective data the response surfaces — for revision-
        // supporting collections, that's the just-saved draft, not the live
        // columns.
        const hydrated = await this.hydrateDraftData(result);
        if (hydrated.success && hydrated.data) {
            const contentIdsToRefresh = [resolvedId];
            if (!usesDraftRevisions && processedData) {
                contentIdsToRefresh.push(...(await this.findSyncedSiblingsForUsageRefresh(collection, resolvedId, hydrated.data.item.translationGroup, processedData)));
            }
            await this.refreshContentUsageAfterSuccessfulWrite(collection, contentIdsToRefresh);
        }
        else if (draftStorageChanged) {
            try {
                await markContentMediaUsageCollectionStale(this.db, collection, "CONTENT_USAGE_STALE");
            }
            catch (error) {
                console.error(`[media-usage] Failed to mark ${collection} stale:`, error);
            }
        }
        // Run afterSave hooks (fire-and-forget)
        if (hydrated.success && hydrated.data) {
            const savedLocale = hydrated.data.item.locale;
            this.runAfterSaveHooks(contentItemToRecord(hydrated.data.item), collection, false, actor, undefined, savedLocale ? { locale: savedLocale } : {});
        }
        if (hydrated.success) {
            return { ...hydrated, liveContentChanged };
        }
        return hydrated;
    }
    async handleContentDelete(collection, id) {
        // Run beforeDelete hooks (trusted plugins)
        if (this.hooks.hasHooks("content:beforeDelete")) {
            const { allowed } = await this.hooks.runContentBeforeDelete(id, collection);
            if (!allowed) {
                return {
                    success: false,
                    error: {
                        code: "DELETE_BLOCKED",
                        message: "Delete blocked by plugin hook",
                    },
                };
            }
        }
        const policyRejectionRevision = await this.getScheduledPolicyRejectionRevision(collection, id);
        // Delete the content
        const result = await handleContentDelete(this.db, collection, id);
        if (result.success) {
            await this.clearScheduledPolicyRejection(collection, result.data.id, policyRejectionRevision);
            await this.refreshContentUsageAfterSuccessfulWrite(collection, [result.data.id]);
        }
        // Run afterDelete hooks (deferred past the response via after())
        if (result.success) {
            this.runAfterDeleteHooks(id, collection, false);
        }
        return result;
    }
    // =========================================================================
    // Trash Handlers
    // =========================================================================
    async handleContentListTrashed(collection, params = {}) {
        return handleContentListTrashed(this.db, collection, params);
    }
    async handleContentRestore(collection, id, options = {}) {
        const result = await handleContentRestore(this.db, collection, id, { _rev: options._rev });
        if (result.success && result.data) {
            await this.refreshContentUsageAfterSuccessfulWrite(collection, [result.data.item.id]);
        }
        // Run afterRestore hooks (fire-and-forget)
        if (result.success) {
            this.runAfterRestoreHooks(contentItemToRecord(result.data.item), collection, options.origin?.source === "plugin" ? options.origin.pluginId : undefined, options.pluginInvocationId);
        }
        return result;
    }
    async handleContentPermanentDelete(collection, id) {
        const policyRejectionRevision = await this.getScheduledPolicyRejectionRevision(collection, id);
        const result = await handleContentPermanentDelete(this.db, collection, id);
        if (result.success) {
            await this.clearScheduledPolicyRejection(collection, result.data.id, policyRejectionRevision);
            await this.deleteContentUsageAfterSuccessfulPermanentDelete(collection, result.data.id);
        }
        // Run afterDelete hooks so plugins (e.g. AI Search) can clean up
        if (result.success) {
            this.runAfterDeleteHooks(id, collection, true);
        }
        return result;
    }
    async handleContentCountTrashed(collection, params = {}) {
        return handleContentCountTrashed(this.db, collection, params);
    }
    async handleContentDuplicate(collection, id, authorId) {
        const result = await handleContentDuplicate(this.db, collection, id, authorId);
        if (result.success && result.data) {
            await this.refreshContentUsageAfterSuccessfulWrite(collection, [result.data.item.id]);
        }
        return result;
    }
    // =========================================================================
    // Publishing & Scheduling Handlers
    // =========================================================================
    pluginVersionedResult(result) {
        if (!result.success) {
            throw Object.assign(new Error(result.error.message), { code: result.error.code });
        }
        if (!result.data._rev)
            throw new Error("Content action returned no revision");
        return { item: toPluginContentItem(result.data.item), _rev: result.data._rev };
    }
    async runPluginContentAction(pluginId, action, collection, id, fn, invocationId, invalidateContentCache) {
        let invocationInvalidator;
        if (invocationId) {
            const invocationKey = this.pluginInvocationKey(pluginId, invocationId);
            if (!this.activePluginInvocations.has(invocationKey) &&
                !this.releasedPluginInvocations.has(invocationKey)) {
                throw Object.assign(new Error("Plugin content action invocation has expired"), {
                    code: "CONTENT_ACTION_INVOCATION_EXPIRED",
                });
            }
            invocationInvalidator = this.pluginInvocationCacheInvalidators.get(invocationKey);
        }
        const recordWrite = await assertSiteWriteAllowed(this.db);
        const repo = new ContentRepository(this.db);
        const item = action === "restore"
            ? await repo.findByIdOrSlugIncludingTrashed(collection, id)
            : await repo.findByIdOrSlug(collection, id);
        const resolvedId = item?.id ?? id;
        const key = this.pluginContentActionKey(collection, resolvedId);
        if ((this.activePluginContentActions.get(key) ?? 0) > 0) {
            throw Object.assign(new Error("Plugin content action re-entered itself"), {
                code: "CONTENT_ACTION_REENTRANT",
            });
        }
        this.retainPluginContentAction(key);
        try {
            const result = await fn(resolvedId);
            await recordWrite();
            const invalidator = invalidateContentCache ?? invocationInvalidator ?? this.pluginContentCacheInvalidator;
            if (invalidator) {
                try {
                    await invalidator([collection, resolvedId]);
                }
                catch (error) {
                    console.error(`[plugin-content-action] Cache invalidation failed for ${collection}/${resolvedId}:`, error);
                }
            }
            return result;
        }
        finally {
            this.releasePluginContentAction(key);
        }
    }
    pluginContentActionKey(collection, id) {
        return JSON.stringify([collection, id]);
    }
    retainPluginContentAction(key) {
        this.activePluginContentActions.set(key, (this.activePluginContentActions.get(key) ?? 0) + 1);
    }
    releasePluginContentAction(key) {
        const remaining = (this.activePluginContentActions.get(key) ?? 1) - 1;
        if (remaining > 0)
            this.activePluginContentActions.set(key, remaining);
        else
            this.activePluginContentActions.delete(key);
    }
    async pluginGetVersioned(_pluginId, collection, id) {
        const result = await this.handleContentGet(collection, id);
        if (!result.success) {
            if (result.error.code === "NOT_FOUND")
                return null;
            throw Object.assign(new Error(result.error.message), { code: result.error.code });
        }
        if (!result.data._rev)
            throw new Error("Content read returned no revision");
        return { item: toPluginContentItem(result.data.item), _rev: result.data._rev };
    }
    async pluginGetTrashedVersioned(_pluginId, collection, id) {
        const result = await this.handleContentGetIncludingTrashed(collection, id);
        if (!result.success) {
            if (result.error.code === "NOT_FOUND")
                return null;
            throw Object.assign(new Error(result.error.message), { code: result.error.code });
        }
        if (!(await new ContentRepository(this.db).isTrashed(collection, result.data.item.id))) {
            return null;
        }
        if (!result.data._rev)
            throw new Error("Trashed content read returned no revision");
        return { item: toPluginContentItem(result.data.item), _rev: result.data._rev };
    }
    pluginPublish(pluginId, collection, id, options, invocationId, invalidateContentCache) {
        return this.runPluginContentAction(pluginId, "publish", collection, id, async (resolvedId) => this.pluginVersionedResult(await this.handleContentPublish(collection, resolvedId, {
            _rev: options._rev,
            origin: { source: "plugin", pluginId },
            pluginInvocationId: invocationId,
        })), invocationId, invalidateContentCache);
    }
    pluginUnpublish(pluginId, collection, id, options, invocationId, invalidateContentCache) {
        return this.runPluginContentAction(pluginId, "unpublish", collection, id, async (resolvedId) => this.pluginVersionedResult(await this.handleContentUnpublish(collection, resolvedId, {
            _rev: options._rev,
            origin: { source: "plugin", pluginId },
            pluginInvocationId: invocationId,
        })), invocationId, invalidateContentCache);
    }
    pluginSchedule(pluginId, collection, id, options, invocationId, invalidateContentCache) {
        return this.runPluginContentAction(pluginId, "schedule", collection, id, async (resolvedId) => this.pluginVersionedResult(await this.handleContentSchedule(collection, resolvedId, options.scheduledAt, {
            _rev: options._rev,
            origin: { source: "plugin", pluginId },
            pluginInvocationId: invocationId,
        })), invocationId, invalidateContentCache);
    }
    pluginUnschedule(pluginId, collection, id, options, invocationId, invalidateContentCache) {
        return this.runPluginContentAction(pluginId, "unschedule", collection, id, async (resolvedId) => this.pluginVersionedResult(await this.handleContentUnschedule(collection, resolvedId, {
            ...options,
            origin: { source: "plugin", pluginId },
            pluginInvocationId: invocationId,
        })), invocationId, invalidateContentCache);
    }
    pluginRestore(pluginId, collection, id, options, invocationId, invalidateContentCache) {
        return this.runPluginContentAction(pluginId, "restore", collection, id, async (resolvedId) => this.pluginVersionedResult(await this.handleContentRestore(collection, resolvedId, {
            ...options,
            origin: { source: "plugin", pluginId },
            pluginInvocationId: invocationId,
        })), invocationId, invalidateContentCache);
    }
    async checkContentPolicy(name, collection, id, options, rejectionCode, failureCode, scheduledAt) {
        let current = await handleContentGet(this.db, collection, id);
        if (!current.success) {
            return {
                allowed: false,
                revision: options._rev ?? "",
                error: current.error,
            };
        }
        const revision = current.data._rev;
        if (!revision) {
            return {
                allowed: false,
                revision: options._rev ?? "",
                error: { code: failureCode, message: "Failed to read content revision" },
            };
        }
        if (options._rev !== undefined && options._rev !== revision) {
            return {
                allowed: false,
                revision,
                error: { code: "CONFLICT", message: "Revision precondition did not match" },
            };
        }
        if (!this.hooks.hasHooks(name))
            return { allowed: true, revision };
        if (name !== "content:beforeUnpublish") {
            try {
                current = await this.hydrateDraftData(current, {
                    includeStagedSlug: true,
                    strict: true,
                });
            }
            catch (error) {
                console.error(`[content-policy] ${name} draft hydration failed:`, error);
                return {
                    allowed: false,
                    revision,
                    error: { code: failureCode, message: `Failed to read content for ${name} policy` },
                };
            }
        }
        const origin = options.origin ?? { source: "system" };
        const actor = options.actor &&
            (origin.source === "api" || origin.source === "mcp" || origin.source === "visual-editor")
            ? { ...options.actor, source: origin.source }
            : undefined;
        try {
            const decision = await this.hooks.runContentPolicy(name, {
                content: contentItemToRecord(current.data.item),
                collection,
                origin,
                actor,
                ...(scheduledAt === undefined ? {} : { scheduledAt }),
            });
            if (decision.cancellation) {
                return {
                    allowed: false,
                    revision,
                    error: { code: rejectionCode, message: decision.cancellation.reason },
                    cancellation: decision.cancellation,
                };
            }
            return { allowed: true, revision };
        }
        catch (error) {
            console.error(`[content-policy] ${name} failed:`, error);
            return {
                allowed: false,
                revision,
                error: { code: failureCode, message: `Failed to run ${name} policy` },
            };
        }
    }
    async getScheduledPolicyRejectionRevision(collection, id) {
        try {
            return (await new OptionsRepository(this.db).getVersioned(scheduledPolicyRejectionKey(collection, id)))?.revision;
        }
        catch (error) {
            console.error(`[content-policy] Failed to read scheduled rejection for ${collection}/${id}:`, error);
            return undefined;
        }
    }
    async clearScheduledPolicyRejection(collection, id, expectedRevision) {
        if (expectedRevision === undefined)
            return;
        try {
            await new OptionsRepository(this.db).compareAndDelete(scheduledPolicyRejectionKey(collection, id), expectedRevision);
        }
        catch (error) {
            console.error(`[content-policy] Failed to clear scheduled rejection for ${collection}/${id}:`, error);
        }
    }
    createScheduledPolicyRejection(collection, id, cancellation) {
        return {
            collection,
            id,
            pluginId: cancellation.pluginId,
            reason: cancellation.reason,
            rejectedAt: (this.runtimeDeps.now?.() ?? new Date()).toISOString(),
        };
    }
    async handleContentPublish(collection, id, options = {}) {
        const policy = await this.checkContentPolicy("content:beforePublish", collection, id, options, "PUBLISH_REJECTED", "CONTENT_PUBLISH_ERROR");
        if (!policy.allowed) {
            if (policy.cancellation && options.origin?.source === "scheduler") {
                const unscheduled = await handleScheduledPolicyRejection(this.db, collection, id, {
                    _rev: policy.revision,
                    rejection: this.createScheduledPolicyRejection(collection, id, policy.cancellation),
                });
                if (!unscheduled.success)
                    return unscheduled;
                await this.refreshContentUsageAfterSuccessfulWrite(collection, [unscheduled.data.item.id]);
                this.runAfterUnscheduleHooks(contentItemToRecord(unscheduled.data.item), collection);
            }
            return { success: false, error: policy.error };
        }
        const policyRejectionRevision = await this.getScheduledPolicyRejectionRevision(collection, id);
        const { actor: _actor, origin: _origin, pluginInvocationId: _pluginInvocationId, ...handlerOptions } = options;
        const result = await handleContentPublish(this.db, collection, id, {
            ...handlerOptions,
            _rev: policy.revision,
        });
        if (result.success && result.data) {
            await this.clearScheduledPolicyRejection(collection, result.data.item.id, policyRejectionRevision);
            const { item } = result.data;
            await this.refreshContentUsageAfterSuccessfulWrite(collection, [
                item.id,
                ...(await this.findSyncedSiblingsForUsageRefresh(collection, item.id, item.translationGroup, item.data, { absentAsCleared: true })),
            ]);
        }
        // Run afterPublish hooks (fire-and-forget)
        if (result.success && result.data) {
            this.runAfterPublishHooks(contentItemToRecord(result.data.item), collection, options.origin?.source === "plugin" ? options.origin.pluginId : undefined, options.pluginInvocationId);
        }
        return result;
    }
    async handleContentUnpublish(collection, id, options = {}) {
        const policy = await this.checkContentPolicy("content:beforeUnpublish", collection, id, options, "UNPUBLISH_REJECTED", "CONTENT_UNPUBLISH_ERROR");
        if (!policy.allowed)
            return { success: false, error: policy.error };
        const result = await handleContentUnpublish(this.db, collection, id, {
            _rev: policy.revision,
        });
        if (result.success && result.data) {
            await this.refreshContentUsageAfterSuccessfulWrite(collection, [result.data.item.id]);
        }
        // Run afterUnpublish hooks (deferred past the response via after())
        if (result.success && result.data) {
            this.runAfterUnpublishHooks(contentItemToRecord(result.data.item), collection, options.origin?.source === "plugin" ? options.origin.pluginId : undefined, options.pluginInvocationId);
        }
        return result;
    }
    async handleContentSchedule(collection, id, scheduledAt, options = {}) {
        const policy = await this.checkContentPolicy("content:beforeSchedule", collection, id, options, "SCHEDULE_REJECTED", "CONTENT_SCHEDULE_ERROR", scheduledAt);
        if (!policy.allowed)
            return { success: false, error: policy.error };
        const policyRejectionRevision = await this.getScheduledPolicyRejectionRevision(collection, id);
        const result = await handleContentSchedule(this.db, collection, id, scheduledAt, this.runtimeDeps.now?.() ?? new Date(), policy.revision);
        if (result.success && result.data) {
            await this.clearScheduledPolicyRejection(collection, result.data.item.id, policyRejectionRevision);
            await this.refreshContentUsageAfterSuccessfulWrite(collection, [result.data.item.id]);
        }
        // Run afterSchedule hooks (fire-and-forget)
        if (result.success && result.data) {
            this.runAfterScheduleHooks(contentItemToRecord(result.data.item), collection, options.origin?.source === "plugin" ? options.origin.pluginId : undefined, options.pluginInvocationId);
        }
        return result;
    }
    async handleContentUnschedule(collection, id, options = {}) {
        const result = await handleContentUnschedule(this.db, collection, id, { _rev: options._rev });
        if (result.success && result.data) {
            await this.refreshContentUsageAfterSuccessfulWrite(collection, [result.data.item.id]);
        }
        // Run afterUnschedule hooks (fire-and-forget)
        if (result.success && result.data) {
            this.runAfterUnscheduleHooks(contentItemToRecord(result.data.item), collection, options.origin?.source === "plugin" ? options.origin.pluginId : undefined, options.pluginInvocationId);
        }
        return result;
    }
    async handleContentCountScheduled(collection) {
        return handleContentCountScheduled(this.db, collection);
    }
    async handleContentDiscardDraft(collection, id, options = {}) {
        const result = await handleContentDiscardDraft(this.db, collection, id, options);
        if (result.success && result.data) {
            await this.refreshContentUsageAfterSuccessfulWrite(collection, [result.data.item.id]);
        }
        return result;
    }
    async handleContentCompare(collection, id) {
        return handleContentCompare(this.db, collection, id);
    }
    async handleContentTranslations(collection, id) {
        return handleContentTranslations(this.db, collection, id);
    }
    // =========================================================================
    // Media Handlers
    // =========================================================================
    async handleMediaList(params) {
        return handleMediaList(this.db, params);
    }
    async handleMediaGet(id) {
        return handleMediaGet(this.db, id);
    }
    async handleMediaUpload(input) {
        if (!this.storage) {
            return {
                success: false,
                error: { code: "NO_STORAGE", message: "Storage not configured" },
            };
        }
        const result = await uploadMedia(this.db, this.storage, input, {
            beforeUpload: async (file) => {
                if (!this.hooks.hasHooks("media:beforeUpload"))
                    return file;
                return (await this.hooks.runMediaBeforeUpload(file)).file;
            },
        });
        if (result.success && !result.data.deduplicated && this.hooks.hasHooks("media:afterUpload")) {
            const item = result.data.item;
            await this.hooks.runMediaAfterUpload({
                id: item.id,
                filename: item.filename,
                mimeType: item.mimeType,
                size: item.size,
                url: item.url,
                createdAt: item.createdAt,
            });
        }
        return result;
    }
    async handleMediaRegisterUpload(input) {
        if (!this.storage) {
            return {
                success: false,
                error: { code: "NO_STORAGE", message: "Storage not configured" },
            };
        }
        const result = await handleMediaRegisterUpload(this.db, this.storage, input);
        if (result.success && this.hooks.hasHooks("media:afterUpload")) {
            const item = result.data.item;
            const mediaItem = {
                id: item.id,
                filename: item.filename,
                mimeType: item.mimeType,
                size: item.size,
                url: `/media/${item.id}/${item.filename}`,
                createdAt: item.createdAt,
            };
            this.hooks
                .runMediaAfterUpload(mediaItem)
                .catch((err) => console.error("EmDash afterUpload hook error:", err));
        }
        return result;
    }
    async handleMediaCreate(input) {
        // Run beforeUpload hooks
        let processedInput = input;
        if (this.hooks.hasHooks("media:beforeUpload")) {
            const hookResult = await this.hooks.runMediaBeforeUpload({
                name: input.filename,
                type: input.mimeType,
                size: input.size || 0,
            });
            processedInput = {
                ...input,
                filename: hookResult.file.name,
                mimeType: hookResult.file.type,
                size: hookResult.file.size,
            };
        }
        // Create the media record
        const result = await handleMediaCreate(this.db, processedInput);
        // Run afterUpload hooks (fire-and-forget)
        if (result.success && this.hooks.hasHooks("media:afterUpload")) {
            const item = result.data.item;
            const mediaItem = {
                id: item.id,
                filename: item.filename,
                mimeType: item.mimeType,
                size: item.size,
                url: `/media/${item.id}/${item.filename}`,
                createdAt: item.createdAt,
            };
            this.hooks
                .runMediaAfterUpload(mediaItem)
                .catch((err) => console.error("EmDash afterUpload hook error:", err));
        }
        return result;
    }
    async handleMediaUpdate(id, input) {
        const result = await handleMediaUpdate(this.db, id, input);
        // Resolved media references in site settings (`logo`, `favicon`,
        // `seo.defaultOgImage`) bake in the media row's `contentType`,
        // `width`, and `height`. A metadata edit invalidates that snapshot
        // for every entry point: REST routes, MCP tools, plugin code, and
        // any future caller of `handleMediaUpdate`. Cross-isolate staleness
        // remains bounded by isolate lifetime.
        if (result.success) {
            invalidateSiteSettingsCache();
        }
        return result;
    }
    async handlePluginMediaMetadataUpdate(id, patch) {
        return updatePluginMediaMetadata(this.db, id, patch);
    }
    async handleMediaReplaceMetadata(id, expectedStorageKey, input) {
        const result = await handleMediaReplaceMetadata(this.db, id, expectedStorageKey, input);
        if (result.success) {
            invalidateSiteSettingsCache();
        }
        return result;
    }
    async handleMediaDelete(id) {
        const result = await handleMediaDelete(this.db, id, this.storage);
        // Same reasoning as `handleMediaUpdate`: if the deleted media row
        // was referenced by a setting, the cached resolved URL now points
        // at a 404. Invalidation is unconditional on success — cheaper than
        // querying which settings reference the id.
        if (result.success) {
            invalidateSiteSettingsCache();
        }
        return result;
    }
    commentHooks() {
        return {
            runBeforeCreate: (event) => this.hooks.runCommentBeforeCreate(event),
            runModerate: async (event) => {
                const result = await this.hooks.invokeExclusiveHook("comment:moderate", event);
                if (!result)
                    return { status: "pending", reason: "No moderator configured" };
                if (result.error) {
                    console.error(`[comments] Moderation error (${result.pluginId}):`, result.error.message);
                    return { status: "pending", reason: "Moderation error" };
                }
                if (!isModerationDecision(result.result)) {
                    return { status: "pending", reason: "Invalid moderation result" };
                }
                return result.result;
            },
            fireAfterCreate: (event) => {
                void this.hooks
                    .runCommentAfterCreate(event)
                    .catch((error) => console.error("[comments] afterCreate error:", error instanceof Error ? error.message : error));
            },
            fireAfterModerate: (event) => {
                return this.hooks
                    .runCommentAfterModerate(event)
                    .catch((error) => console.error("[comments] afterModerate error:", error instanceof Error ? error.message : error));
            },
        };
    }
    async handleCommentCreate(input, settings, contentInfo) {
        return createComment(this.db, input, settings, this.commentHooks(), contentInfo);
    }
    async handlePublicCommentSubmission(collection, contentId, request, user) {
        return submitPublicComment(this, collection, contentId, request, user);
    }
    async sendCommentApproval(comment, request) {
        if (!comment || !this.email)
            return;
        try {
            const adminBaseUrl = await getSiteBaseUrl(this.db, request ?? new Request("https://plugin.invalid/"), this.config);
            const content = await lookupContentAuthor(this.db, comment.collection, comment.contentId);
            if (content?.author) {
                await sendCommentNotification({
                    email: this.email,
                    comment,
                    contentAuthor: content.author,
                    adminBaseUrl,
                });
            }
        }
        catch (error) {
            console.error("[comments] notification error:", error instanceof Error ? error.message : error);
        }
    }
    async moderateCommentWithOrigin(id, status, expectedStatus, origin, request) {
        if (this.commentModerationInProgress.has(id)) {
            const current = await new CommentRepository(this.db).findById(id);
            if (current && current.status !== expectedStatus) {
                throw new CommentStatusConflictError(current.status);
            }
            throw Object.assign(new Error("Comment moderation is already in progress"), {
                code: "COMMENT_MODERATION_IN_PROGRESS",
            });
        }
        this.commentModerationInProgress.add(id);
        try {
            return await moderateComment(this.db, id, status, expectedStatus, origin, this.commentHooks(), (comment) => this.sendCommentApproval(comment, request));
        }
        finally {
            this.commentModerationInProgress.delete(id);
        }
    }
    async handleCommentModerate(id, status, moderator, expectedStatus, request) {
        let expected = expectedStatus;
        if (!expected) {
            const current = await new CommentRepository(this.db).findById(id);
            if (!current || current.status === "trash")
                return null;
            expected = current.status;
        }
        return this.moderateCommentWithOrigin(id, status, expected, { source: "admin", userId: moderator.id, name: moderator.name }, request);
    }
    async handlePluginCommentModerate(pluginId, id, status, expectedStatus) {
        assertPluginCommentStatus(status, "status");
        assertPluginCommentStatus(expectedStatus, "expectedStatus");
        const updated = await this.moderateCommentWithOrigin(id, status, expectedStatus, {
            source: "plugin",
            pluginId,
        });
        if (!updated)
            throw new Error(`Comment not found: ${id}`);
        const result = await createCommentAccess(this.db).get(id);
        if (!result)
            throw new Error(`Comment not found: ${id}`);
        return result;
    }
    // =========================================================================
    // Revision Handlers
    // =========================================================================
    async handleRevisionList(collection, entryId, params = {}) {
        return handleRevisionList(this.db, collection, entryId, params);
    }
    async handleRevisionGet(revisionId) {
        return handleRevisionGet(this.db, revisionId);
    }
    async handleRevisionRestore(revisionId, callerUserId) {
        // Discover the parent entry up front so we can branch on whether
        // the collection uses draft revisions.
        const revisionRepo = new RevisionRepository(this.db);
        const revision = await revisionRepo.findById(revisionId);
        if (!revision) {
            return {
                success: false,
                error: {
                    code: "NOT_FOUND",
                    message: `Revision not found: ${revisionId}`,
                },
            };
        }
        const collectionInfo = await this.schemaRegistry.getCollectionWithFields(revision.collection);
        const usesDraftRevisions = collectionInfo?.supports?.includes("revisions") ?? false;
        // Non-revision collections: keep the legacy behavior of writing the
        // revision's data straight onto the live row. This preserves
        // behavior for collections that opt out of the draft model.
        if (!usesDraftRevisions) {
            const result = await handleRevisionRestore(this.db, revisionId, callerUserId);
            if (result.success) {
                await this.refreshContentUsageAfterSuccessfulWrite(revision.collection, [revision.entryId]);
            }
            return this.hydrateDraftData(result);
        }
        // Revision-capable collections: restore is "make this revision the
        // current draft". The live row's data columns are left untouched
        // (only `draft_revision_id` changes — no `updated_at` stamp, since
        // restoring to draft is the same kind of draft-only staging as
        // Save/Autosave and must not register a phantom modification for
        // sitemap <lastmod> / JSON-LD dateModified, #2143). The caller
        // must then `content_publish` to promote the restored draft to
        // live, matching the documented tool contract.
        try {
            const contentRepo = new ContentRepository(this.db);
            const restoredData = { ...revision.data };
            delete restoredData[STAGED_REFERENCES_BASELINE_KEY];
            const newDraftId = await contentRepo.restoreDraftRevision(revision.collection, revision.entryId, restoredData, callerUserId);
            if (!newDraftId) {
                return {
                    success: false,
                    error: {
                        code: "NOT_FOUND",
                        message: `Content item not found: ${revision.entryId}`,
                    },
                };
            }
            after(async () => {
                try {
                    await revisionRepo.pruneQueuedEntry(revision.collection, revision.entryId, newDraftId, 50);
                }
                catch (error) {
                    console.error(`[revisions] Failed to prune revisions for ${revision.collection}/${revision.entryId}:`, error);
                }
            });
            // Return the freshly-fetched item with the new draft hydrated
            // onto `data`. Without this the response would echo the live
            // columns and the next `content_get` would surface different
            // values (the bug that motivated this rewrite).
            const refetched = await handleContentGet(this.db, revision.collection, revision.entryId);
            const hydrated = await this.hydrateDraftData(refetched);
            if (hydrated.success) {
                await this.refreshContentUsageAfterSuccessfulWrite(revision.collection, [revision.entryId]);
            }
            return hydrated;
        }
        catch (error) {
            if (error instanceof ContentMutationConflictError) {
                return {
                    success: false,
                    error: { code: "CONFLICT", message: error.message },
                };
            }
            console.error("[emdash] revision restore failed:", error);
            return {
                success: false,
                error: {
                    code: "REVISION_RESTORE_ERROR",
                    message: "Failed to restore revision",
                },
            };
        }
    }
    async findSyncedSiblingsForUsageRefresh(collection, contentId, translationGroup, data, options = {}) {
        try {
            return await findNonTranslatableSiblingContentIds(this.db, collection, contentId, translationGroup, data, options);
        }
        catch (error) {
            console.error(`[media-usage] Failed to discover synced i18n siblings for ${collection}/${contentId}:`, error);
            try {
                await markContentMediaUsageCollectionStale(this.db, collection, "CONTENT_USAGE_REFRESH_ERROR");
            }
            catch (staleError) {
                console.error(`[media-usage] Failed to mark ${collection} stale:`, staleError);
            }
            return [];
        }
    }
    async refreshContentUsageAfterSuccessfulWrite(collection, contentIds) {
        for (const contentId of new Set(contentIds)) {
            try {
                const work = await processMediaUsageWorkAfterWrite(this.db, collection, contentId);
                if (work.outcome !== "inactive")
                    continue;
                await refreshContentMediaUsageAfterWrite(this.db, collection, contentId);
            }
            catch (error) {
                console.error(`[media-usage] Failed after content write ${collection}/${contentId}:`, error);
                continue;
            }
        }
    }
    async deleteContentUsageAfterSuccessfulPermanentDelete(collection, contentId) {
        try {
            const work = await processMediaUsageWorkAfterWrite(this.db, collection, contentId);
            if (work.outcome !== "inactive")
                return;
            const result = await deleteContentMediaUsage(this.db, collection, contentId);
            if (!result.success) {
                console.error(`[media-usage] Usage delete for ${collection}/${contentId} finished with ${result.errorCode}`);
            }
        }
        catch (error) {
            console.error(`[media-usage] Failed after permanent content delete ${collection}/${contentId}:`, error);
        }
    }
    // =========================================================================
    // Plugin Routes
    // =========================================================================
    getSandboxedAdminDefinition(pluginId) {
        const entry = this.sandboxedPluginEntries.find((candidate) => candidate.id === pluginId);
        if (entry) {
            const pages = (entry.adminPages ?? []).map((page) => normalizePluginPagePath(page.path));
            const imageHosts = allowedBrowserImageHosts(entry.capabilities, entry.allowedHosts);
            return {
                pages,
                widgets: (entry.adminWidgets ?? []).map((widget) => widget.id),
                policy: { pluginPagePaths: pages, allowedImageHosts: imageHosts },
            };
        }
        const manifest = marketplaceManifestCache.get(pluginId);
        if (!manifest)
            return null;
        const pages = (manifest.admin?.pages ?? []).map((page) => normalizePluginPagePath(page.path));
        const imageHosts = allowedBrowserImageHosts(manifest.capabilities ?? [], manifest.allowedHosts ?? []);
        return {
            pages,
            widgets: (manifest.admin?.widgets ?? []).map((widget) => widget.id),
            policy: { pluginPagePaths: pages, allowedImageHosts: imageHosts },
        };
    }
    resolvePluginUiContext(definition, body, request) {
        if (typeof body !== "object" || body === null || !("page" in body))
            return {};
        const page = body.page;
        if (typeof page !== "string") {
            return {
                error: { code: "INVALID_PLUGIN_UI_CONTEXT", message: "Plugin UI page must be a string" },
            };
        }
        let surface;
        if (page.startsWith("widget:")) {
            if (!definition.widgets.includes(page.slice("widget:".length))) {
                return {
                    error: {
                        code: "INVALID_PLUGIN_UI_CONTEXT",
                        message: "Plugin dashboard widget is not declared",
                    },
                };
            }
            surface = "dashboard-widget";
        }
        else {
            if (!definition.pages.includes(normalizePluginPagePath(page))) {
                return {
                    error: {
                        code: "INVALID_PLUGIN_UI_CONTEXT",
                        message: "Plugin admin page is not declared",
                    },
                };
            }
            surface = "admin-page";
        }
        const locale = resolveLocale(request);
        return { context: { surface, locale, direction: getLocaleDir(locale) } };
    }
    /**
     * UI context for a configured plugin's Block Kit page or widget. An
     * undeclared surface yields no context and no error: configured plugins
     * are not held to their declarations, so rejecting here would break
     * configured plugins that serve undeclared pages.
     */
    resolveTrustedUiContext(plugin, routeKey, body, request) {
        if (routeKey !== "admin")
            return undefined;
        const surfaces = {
            pages: (plugin.admin.pages ?? []).map((page) => normalizePluginPagePath(page.path)),
            widgets: (plugin.admin.widgets ?? []).map((widget) => widget.id),
        };
        return this.resolvePluginUiContext(surfaces, body, request).context;
    }
    validateSandboxedAdminResponse(pluginId, definition, result) {
        if (!result.success)
            return result;
        const validation = validateBlockResponse(result.data, definition.policy);
        if (validation.valid)
            return result;
        console.error(`EmDash: Sandboxed plugin ${pluginId} returned invalid Block Kit content:`, validation.errors);
        return {
            success: false,
            status: 502,
            error: {
                code: "INVALID_BLOCK_RESPONSE",
                message: "Plugin returned invalid Block Kit content",
            },
        };
    }
    getPluginEditorExtension(pluginId, kind, extensionId, collection) {
        if (!this.isPluginEnabled(pluginId))
            return null;
        let panels;
        let actions;
        let pages = [];
        let capabilities = [];
        let allowedHosts = [];
        const configured = this.configuredPlugins.find((plugin) => plugin.id === pluginId);
        if (configured) {
            if (configured.admin.entry)
                return null;
            panels = configured.admin.editorPanels;
            actions = configured.admin.editorActions;
            pages = (configured.admin.pages ?? []).map((page) => page.path);
            capabilities = configured.capabilities;
            allowedHosts = configured.allowedHosts;
        }
        else {
            const entry = this.sandboxedPluginEntries.find((candidate) => candidate.id === pluginId);
            if (entry) {
                panels = entry.editorPanels;
                actions = entry.editorActions;
                pages = (entry.adminPages ?? []).map((page) => page.path);
                capabilities = entry.capabilities;
                allowedHosts = entry.allowedHosts;
            }
            else {
                const manifest = marketplaceManifestCache.get(pluginId);
                if (!manifest)
                    return null;
                panels = manifest.admin?.editorPanels;
                actions = manifest.admin?.editorActions;
                pages = (manifest.admin?.pages ?? []).map((page) => page.path);
                capabilities = manifest.capabilities ?? [];
                allowedHosts = manifest.allowedHosts ?? [];
            }
        }
        const normalizedCapabilities = normalizePluginCapabilities(capabilities);
        const policy = {
            pluginPagePaths: pages,
            allowedImageHosts: allowedBrowserImageHosts(capabilities, allowedHosts),
        };
        if (kind === "panel") {
            const matches = panels?.filter((panel) => panel.id === extensionId) ?? [];
            const extension = matches[0];
            if (matches.length !== 1 ||
                !extension ||
                (extension.collections && !extension.collections.includes(collection))) {
                return null;
            }
            return { kind, extension, policy, capabilities: normalizedCapabilities };
        }
        const matches = actions?.filter((action) => action.id === extensionId) ?? [];
        const extension = matches[0];
        if (matches.length !== 1 ||
            !extension ||
            (extension.collections && !extension.collections.includes(collection)) ||
            (extension.style === "danger" && !extension.confirm)) {
            return null;
        }
        return { kind, extension, policy, capabilities: normalizedCapabilities };
    }
    async getPluginEditorDraftSchema(collection) {
        return this.schemaRegistry.getCollectionWithFields(collection);
    }
    validatePluginEditorExtensionResponse(pluginId, dispatch, result) {
        if (!result.success)
            return result;
        const validation = dispatch.kind === "panel"
            ? validateBlockResponse(result.data, dispatch.policy)
            : validateContentEditorActionResponse(result.data, dispatch.policy);
        if (validation.valid)
            return result;
        console.error(`EmDash: Plugin ${pluginId} returned an invalid content editor ${dispatch.kind} response:`, validation.errors);
        return {
            success: false,
            status: 502,
            error: {
                code: dispatch.kind === "panel" ? "INVALID_BLOCK_RESPONSE" : "INVALID_EDITOR_ACTION_RESPONSE",
                message: "Plugin returned an invalid editor extension response",
            },
        };
    }
    /**
     * Get route metadata for a plugin route without invoking the handler.
     * Used by the catch-all route to decide auth before dispatch.
     * Returns null if the plugin or route doesn't exist.
     */
    getPluginRouteMeta(pluginId, path) {
        if (!this.isPluginEnabled(pluginId))
            return null;
        const routeKey = path.replace(LEADING_SLASH_PATTERN, "");
        // Check trusted plugins first
        const trustedPlugin = this.configuredPlugins.find((p) => p.id === pluginId);
        if (trustedPlugin) {
            const route = trustedPlugin.routes[routeKey];
            if (!route)
                return null;
            return buildRouteMeta(route);
        }
        // Check sandboxed plugin route metadata cache
        const meta = sandboxedRouteMetaCache.get(pluginId);
        if (meta) {
            const routeMeta = meta.get(routeKey);
            if (routeMeta)
                return routeMeta;
        }
        // The "admin" route is implicitly available for any sandboxed plugin
        // that declares admin pages or widgets. This handles plugins installed
        // from bundles that predate the explicit admin route requirement.
        if (routeKey === "admin") {
            const manifestMeta = marketplaceManifestCache.get(pluginId);
            if (manifestMeta?.admin?.pages?.length || manifestMeta?.admin?.widgets?.length) {
                return { public: false };
            }
            // Also check build-time sandboxed entries
            const entry = this.sandboxedPluginEntries.find((e) => e.id === pluginId);
            if (entry?.adminPages?.length || entry?.adminWidgets?.length) {
                return { public: false };
            }
        }
        // Fallback: if the plugin exists in the sandbox cache, allow the route.
        // The sandbox runner will return an error if the route doesn't actually exist.
        if (this.findSandboxedPlugin(pluginId)) {
            return { public: false };
        }
        return null;
    }
    /**
     * Resolve the settings schema for a runtime-installed (marketplace or
     * registry) plugin from its cached manifest. Returns `{}` for a known
     * plugin without a schema and `null` for unknown plugins, matching the
     * contract of `getPluginSettingsSchema` for build-time plugins.
     */
    getRuntimePluginSettingsSchema(pluginId) {
        const meta = marketplaceManifestCache.get(pluginId);
        if (!meta)
            return null;
        return meta.admin?.settingsSchema ?? {};
    }
    async handlePluginApiRoute(pluginId, method, path, request, user, invalidateContentCache, editorDispatch) {
        if (!this.isPluginEnabled(pluginId)) {
            return {
                success: false,
                error: { code: "NOT_FOUND", message: `Plugin not enabled: ${pluginId}` },
            };
        }
        const normalizedMethod = method.toUpperCase();
        const routeMeta = this.getPluginRouteMeta(pluginId, path);
        if (routeMeta?.methods && !routeMeta.methods.some((allowed) => allowed === normalizedMethod)) {
            return {
                success: false,
                status: 405,
                error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed" },
            };
        }
        // Authenticated caller for `ctx.user`. Undefined for public routes
        // (the catch-all only forwards the caller after private-route auth)
        // and for machine tokens with no bound user.
        const caller = user ? toRouteCallerInfo(user) : undefined;
        let body;
        try {
            body = await parseRouteInput(request, routeMeta?.request);
        }
        catch (error) {
            if (error instanceof PluginRouteRequestError) {
                return {
                    success: false,
                    status: error.status,
                    error: { code: "INVALID_PLUGIN_REQUEST", message: error.message },
                };
            }
            throw error;
        }
        const routeKey = path.replace(LEADING_SLASH_PATTERN, "");
        const adminDefinition = !editorDispatch && routeKey === "admin" ? this.getSandboxedAdminDefinition(pluginId) : null;
        const uiResult = adminDefinition
            ? this.resolvePluginUiContext(adminDefinition, body, request)
            : {};
        if (uiResult.error)
            return { success: false, status: 400, error: uiResult.error };
        // Check trusted (configured) plugins first — this must match the
        // resolution order in getPluginRouteMeta to avoid auth/execution mismatches.
        const trustedPlugin = this.configuredPlugins.find((p) => p.id === pluginId);
        if (trustedPlugin && this.enabledPlugins.has(trustedPlugin.id)) {
            const routeRegistry = new PluginRouteRegistry({
                ...this.pipelineFactoryOptions,
                contentActions: this.contentActionsWithInvalidator(invalidateContentCache),
                emailPipeline: this.email ?? undefined,
                cronReschedule: () => this.cronScheduler?.reschedule(),
                trustedProxyHeaders: getTrustedProxyHeaders(this.config),
            });
            routeRegistry.register(trustedPlugin);
            const result = await routeRegistry.invoke(pluginId, routeKey, {
                request,
                body,
                user: caller,
                ui: editorDispatch?.ui ??
                    uiResult.context ??
                    this.resolveTrustedUiContext(trustedPlugin, routeKey, body, request),
            });
            return editorDispatch
                ? this.validatePluginEditorExtensionResponse(pluginId, editorDispatch, result)
                : adminDefinition
                    ? this.validateSandboxedAdminResponse(pluginId, adminDefinition, result)
                    : result;
        }
        // Check sandboxed (marketplace) plugins second
        const sandboxedPlugin = this.findSandboxedPlugin(pluginId);
        if (sandboxedPlugin) {
            const result = await this.handleSandboxedRoute(sandboxedPlugin, path, request, body, routeMeta ?? { public: false }, caller, editorDispatch?.ui ?? uiResult.context, invalidateContentCache);
            return editorDispatch
                ? this.validatePluginEditorExtensionResponse(pluginId, editorDispatch, result)
                : adminDefinition
                    ? this.validateSandboxedAdminResponse(pluginId, adminDefinition, result)
                    : result;
        }
        return {
            success: false,
            error: { code: "NOT_FOUND", message: `Plugin not found: ${pluginId}` },
        };
    }
    contentActionsWithInvalidator(invalidateContentCache) {
        const actions = this.pipelineFactoryOptions.contentActions;
        if (!actions || !invalidateContentCache)
            return actions;
        return {
            ...actions,
            begin: (pluginId, invocationId, invocationInvalidator) => actions.begin?.(pluginId, invocationId, invocationInvalidator ?? invalidateContentCache),
            publish: (pluginId, collection, id, options, invocationId) => actions.publish(pluginId, collection, id, options, invocationId, invalidateContentCache),
            unpublish: (pluginId, collection, id, options, invocationId) => actions.unpublish(pluginId, collection, id, options, invocationId, invalidateContentCache),
            schedule: (pluginId, collection, id, options, invocationId) => actions.schedule(pluginId, collection, id, options, invocationId, invalidateContentCache),
            unschedule: (pluginId, collection, id, options, invocationId) => actions.unschedule(pluginId, collection, id, options, invocationId, invalidateContentCache),
            restore: (pluginId, collection, id, options, invocationId) => actions.restore(pluginId, collection, id, options, invocationId, invalidateContentCache),
        };
    }
    async getPluginMcpTools(pluginId) {
        const tools = [];
        const seen = new Set();
        for (const plugin of this.configuredPlugins) {
            if (pluginId && plugin.id !== pluginId)
                continue;
            for (const [name, tool] of Object.entries(plugin.mcp?.tools ?? {})) {
                const route = plugin.routes[tool.route];
                if (!route ||
                    route.public ||
                    route.response === "raw" ||
                    !isJsonPostRouteContract(route) ||
                    !route.permission ||
                    !Object.hasOwn(Permissions, route.permission))
                    continue;
                const key = `${plugin.id}__${name}`;
                if (seen.has(key))
                    continue;
                seen.add(key);
                tools.push({
                    pluginId: plugin.id,
                    name,
                    description: tool.description,
                    route: tool.route,
                    permission: route.permission,
                    destructive: tool.destructive ?? false,
                    inputSchema: tool.input,
                    outputSchema: tool.output,
                });
            }
        }
        const addManifestTools = (id, mcp) => {
            if (pluginId && id !== pluginId)
                return;
            for (const tool of mcp?.tools ?? []) {
                const key = `${id}__${tool.name}`;
                const routeMeta = this.getPluginRouteMeta(id, tool.route);
                if (seen.has(key) ||
                    !routeMeta ||
                    routeMeta.public ||
                    routeMeta.response === "raw" ||
                    !isJsonPostRouteContract(routeMeta) ||
                    routeMeta.permission !== tool.permission ||
                    !Object.hasOwn(Permissions, tool.permission)) {
                    continue;
                }
                seen.add(key);
                tools.push({
                    pluginId: id,
                    name: tool.name,
                    description: tool.description,
                    route: tool.route,
                    permission: tool.permission,
                    destructive: tool.destructive,
                    inputSchema: z.fromJSONSchema({ ...tool.inputSchema }),
                    outputSchema: tool.outputSchema ? z.fromJSONSchema({ ...tool.outputSchema }) : undefined,
                });
            }
        };
        for (const entry of this.sandboxedPluginEntries)
            addManifestTools(entry.id, entry.mcp);
        for (const [id, manifest] of marketplaceManifestCache)
            addManifestTools(id, manifest.mcp);
        return tools;
    }
    async getEnabledPluginMcpTools() {
        const [tools, states] = await Promise.all([
            this.getPluginMcpTools(),
            new PluginStateRepository(this.db).getAll(),
        ]);
        const stateByPlugin = new Map(states.map((state) => [state.pluginId, state]));
        return tools.filter((tool) => {
            const state = stateByPlugin.get(tool.pluginId);
            if (!state?.mcpToolsEnabled ||
                state.status !== "active" ||
                !this.isPluginEnabled(tool.pluginId)) {
                return false;
            }
            const consented = state.mcpToolsConsent;
            return consented === this.serializePluginMcpConsent(tools, tool.pluginId);
        });
    }
    serializePluginMcpConsent(tools, pluginId) {
        return JSON.stringify(tools
            .filter((tool) => tool.pluginId === pluginId)
            .map((tool) => ({
            name: tool.name,
            description: tool.description,
            route: tool.route,
            permission: tool.permission,
            destructive: tool.destructive,
            inputSchema: z.toJSONSchema(tool.inputSchema, { target: "draft-7" }),
            ...(tool.outputSchema
                ? { outputSchema: z.toJSONSchema(tool.outputSchema, { target: "draft-7" }) }
                : {}),
        }))
            .toSorted((a, b) => a.name.localeCompare(b.name)));
    }
    async handlePluginMcpTool(pluginId, toolName, route, input, actorId, request, caller, invalidateContentCache) {
        const requestMeta = extractRequestMeta(request, getTrustedProxyHeaders(this.config));
        const audit = new AuditRepository(this.db);
        const headers = new Headers(request.headers);
        headers.delete("content-length");
        headers.delete("content-encoding");
        const internalRequest = new Request(request.url, {
            method: "POST",
            headers,
            body: JSON.stringify(input),
        });
        const result = await this.handlePluginApiRoute(pluginId, "POST", route, internalRequest, caller, invalidateContentCache);
        await audit.log({
            actorId,
            actorIp: requestMeta.ip ?? undefined,
            action: "plugin_tool_invoke",
            resourceType: "plugin_mcp_tool",
            resourceId: `${pluginId}__${toolName}`,
            details: { pluginId, tool: toolName, route },
            status: result.success ? "success" : "failure",
        });
        return result;
    }
    async handlePluginMcpDenied(pluginId, toolName, route, actorId, request, reason) {
        const requestMeta = extractRequestMeta(request, getTrustedProxyHeaders(this.config));
        await new AuditRepository(this.db).log({
            actorId,
            actorIp: requestMeta.ip ?? undefined,
            action: "plugin_tool_invoke",
            resourceType: "plugin_mcp_tool",
            resourceId: `${pluginId}__${toolName}`,
            details: { pluginId, tool: toolName, route, reason },
            status: "denied",
        });
    }
    // =========================================================================
    // Sandboxed Plugin Helpers
    // =========================================================================
    findSandboxedPlugin(pluginId) {
        for (const [key, plugin] of this.sandboxedPlugins) {
            if (key.startsWith(pluginId + ":")) {
                return plugin;
            }
        }
        return undefined;
    }
    /**
     * Drop incoming keys that have no matching collection field when the entry
     * already stores them in its live data or current draft revision.
     *
     * Draft revisions keep the full `data` JSON, so deleting a field can strand
     * the old value; this lets a read-then-write save succeed without allowing
     * genuinely unknown keys.
     */
    async dropUnknownKeysAlreadyStored(data, existing, knownFieldSlugs) {
        if (!existing)
            return data;
        let stored = existing.data ?? {};
        if (existing.draftRevisionId) {
            const draft = await new RevisionRepository(this.db)
                .findById(existing.draftRevisionId)
                .catch(() => null);
            if (draft?.data)
                stored = draft.data;
        }
        const stale = staleStoredKeys(data, stored, knownFieldSlugs);
        if (stale.length === 0)
            return data;
        const result = { ...data };
        for (const key of stale)
            delete result[key];
        return result;
    }
    /**
     * Normalize field values in content data before validation.
     * Turns a blank string in an array-valued field into `null`, and fills
     * missing image/file dimensions, storageKey, mimeType, and filename from providers.
     */
    async normalizeFieldValues(collection, data, preloaded, preloadedBlockTypes, includeBlocks = true) {
        let collectionInfo = preloaded;
        if (collectionInfo === undefined) {
            try {
                collectionInfo = await this.schemaRegistry.getCollectionWithFields(collection);
            }
            catch {
                return data;
            }
        }
        if (!collectionInfo?.fields)
            return data;
        const result = { ...data };
        for (const field of collectionInfo.fields) {
            const value = result[field.slug];
            if (ARRAY_FIELD_TYPES.has(field.type) && typeof value === "string" && !value.trim()) {
                result[field.slug] = null;
            }
        }
        const imageFields = collectionInfo.fields.filter((f) => f.type === "image" || f.type === "file");
        // Repeater fields can contain image sub-fields, whose values need the same normalization
        // (a bare media id posted inside a repeater item would otherwise be stored verbatim and
        // render as "Image not found" in the admin).
        const repeaterFields = collectionInfo.fields.filter((f) => f.type === "repeater" && Array.isArray(f.validation?.subFields));
        const blockFields = includeBlocks
            ? collectionInfo.fields.filter((field) => field.type === "blocks")
            : [];
        if (imageFields.length === 0 && repeaterFields.length === 0 && blockFields.length === 0) {
            return result;
        }
        const getProvider = (id) => this.getMediaProvider(id);
        for (const field of imageFields) {
            const value = result[field.slug];
            if (value == null)
                continue;
            try {
                // Only image fields carry a dark variant.
                const normalized = field.type === "image"
                    ? await normalizeImageValue(value, getProvider)
                    : await normalizeMediaValue(value, getProvider);
                if (normalized) {
                    result[field.slug] = normalized;
                }
            }
            catch {
                // Don't fail the save if normalization fails for a single field
            }
        }
        for (const field of repeaterFields) {
            const value = result[field.slug];
            if (!Array.isArray(value))
                continue;
            const mediaSubFieldSlugs = (field.validation?.subFields ?? [])
                .filter((sub) => sub.type === "image")
                .map((sub) => sub.slug);
            if (mediaSubFieldSlugs.length === 0)
                continue;
            const items = value;
            result[field.slug] = await Promise.all(items.map(async (item) => {
                if (!isRecord(item))
                    return item;
                const normalizedItem = { ...item };
                for (const slug of mediaSubFieldSlugs) {
                    const subValue = normalizedItem[slug];
                    if (subValue == null)
                        continue;
                    try {
                        const normalized = await normalizeImageValue(subValue, getProvider);
                        if (normalized) {
                            normalizedItem[slug] = normalized;
                        }
                    }
                    catch {
                        // Don't fail the save if normalization fails for a single sub-field
                    }
                }
                return normalizedItem;
            }));
        }
        if (blockFields.length > 0) {
            const blockTypes = preloadedBlockTypes ?? (await resolveBlockTypes(this.db));
            for (const field of blockFields) {
                const value = result[field.slug];
                if (!Array.isArray(value))
                    continue;
                result[field.slug] = await Promise.all(value.map(async (block) => {
                    if (!isRecord(block) || typeof block._type !== "string")
                        return block;
                    const type = blockTypes.get(block._type);
                    const version = type?.versions.find((candidate) => candidate.version === block._version);
                    if (!version || version.unsupportedTypes?.length)
                        return block;
                    const normalizedBlock = { ...block };
                    for (const nestedField of version.fields) {
                        const nestedValue = normalizedBlock[nestedField.slug];
                        if (nestedValue == null)
                            continue;
                        try {
                            if (nestedField.type === "image") {
                                const normalized = await normalizeImageValue(nestedValue, getProvider);
                                if (normalized)
                                    normalizedBlock[nestedField.slug] = normalized;
                            }
                            else if (nestedField.type === "file") {
                                const normalized = await normalizeMediaValue(nestedValue, getProvider);
                                if (normalized)
                                    normalizedBlock[nestedField.slug] = normalized;
                            }
                            else if (nestedField.type === "repeater" && Array.isArray(nestedValue)) {
                                const imageSlugs = (nestedField.validation?.subFields ?? [])
                                    .filter((subField) => subField.type === "image")
                                    .map((subField) => subField.slug);
                                normalizedBlock[nestedField.slug] = await Promise.all(nestedValue.map(async (item) => {
                                    if (!isRecord(item))
                                        return item;
                                    const normalizedItem = { ...item };
                                    for (const slug of imageSlugs) {
                                        try {
                                            const normalized = await normalizeImageValue(normalizedItem[slug], getProvider);
                                            if (normalized)
                                                normalizedItem[slug] = normalized;
                                        }
                                        catch {
                                            continue;
                                        }
                                    }
                                    return normalizedItem;
                                }));
                            }
                        }
                        catch {
                            continue;
                        }
                    }
                    return normalizedBlock;
                }));
            }
        }
        return result;
    }
    runAfterSaveHooks(content, collection, isNew, actor, excludePluginId, details) {
        after(async () => {
            // Trusted plugins
            if (this.hooks.hasHooks("content:afterSave")) {
                try {
                    await this.hooks.runContentAfterSave(content, collection, isNew, actor, excludePluginId, details);
                }
                catch (err) {
                    console.error("EmDash afterSave hook error:", err);
                }
            }
        });
    }
    runAfterDeleteHooks(id, collection, permanent) {
        after(async () => {
            // Trusted plugins
            if (this.hooks.hasHooks("content:afterDelete")) {
                try {
                    await this.hooks.runContentAfterDelete(id, collection, permanent);
                }
                catch (err) {
                    console.error("EmDash afterDelete hook error:", err);
                }
            }
        });
    }
    runDeferredContentHook(name, content, collection, afterPluginId, pluginInvocationId) {
        const label = name.slice("content:".length);
        const invoke = async () => {
            // Trusted plugins
            if (this.hooks.hasHooks(name)) {
                try {
                    switch (name) {
                        case "content:afterPublish":
                            await this.hooks.runContentAfterPublish(content, collection);
                            break;
                        case "content:afterUnpublish":
                            await this.hooks.runContentAfterUnpublish(content, collection);
                            break;
                        case "content:afterRestore":
                            await this.hooks.runContentAfterRestore(content, collection);
                            break;
                        case "content:afterSchedule":
                            await this.hooks.runContentAfterSchedule(content, collection);
                            break;
                        case "content:afterUnschedule":
                            await this.hooks.runContentAfterUnschedule(content, collection);
                            break;
                    }
                }
                catch (err) {
                    console.error(`EmDash ${label} hook error:`, err);
                }
            }
        };
        const contentId = typeof content.id === "string" ? content.id : undefined;
        const guardKey = afterPluginId && contentId ? this.pluginContentActionKey(collection, contentId) : undefined;
        const invokeWithGuard = async () => {
            if (guardKey)
                this.retainPluginContentAction(guardKey);
            try {
                await invoke();
            }
            finally {
                if (guardKey)
                    this.releasePluginContentAction(guardKey);
            }
        };
        if (afterPluginId && pluginInvocationId && this.findSandboxedPlugin(afterPluginId)) {
            const key = this.pluginInvocationKey(afterPluginId, pluginInvocationId);
            if (!this.activePluginInvocations.has(key) || this.releasedPluginInvocations.has(key)) {
                after(invokeWithGuard);
                return;
            }
            const pending = this.pendingPluginAfterHooks.get(key) ?? [];
            pending.push(invokeWithGuard);
            this.pendingPluginAfterHooks.set(key, pending);
            return;
        }
        after(invokeWithGuard);
    }
    pluginInvocationKey(pluginId, invocationId) {
        return JSON.stringify([pluginId, invocationId]);
    }
    beginPluginInvocation(pluginId, invocationId, invalidateContentCache) {
        const key = this.pluginInvocationKey(pluginId, invocationId);
        this.pendingPluginAfterHooks.delete(key);
        this.releasedPluginInvocations.delete(key);
        if (invalidateContentCache)
            this.pluginInvocationCacheInvalidators.set(key, invalidateContentCache);
        else
            this.pluginInvocationCacheInvalidators.delete(key);
        this.activePluginInvocations.add(key);
    }
    flushPluginAfterHooks(pluginId, invocationId, final = true) {
        if (!invocationId)
            return Promise.resolve();
        const key = this.pluginInvocationKey(pluginId, invocationId);
        this.releasedPluginInvocations.add(key);
        const pending = this.pendingPluginAfterHooks.get(key) ?? [];
        this.pendingPluginAfterHooks.delete(key);
        for (const invoke of pending)
            after(invoke);
        if (final) {
            this.releasedPluginInvocations.delete(key);
            this.activePluginInvocations.delete(key);
            this.pluginInvocationCacheInvalidators.delete(key);
        }
        else {
            const timer = setTimeout(() => {
                this.releasedPluginInvocations.delete(key);
                this.activePluginInvocations.delete(key);
                this.pluginInvocationCacheInvalidators.delete(key);
            }, PLUGIN_INVOCATION_RELEASE_GRACE_MS);
            if (typeof timer === "object")
                timer.unref();
        }
        return Promise.resolve();
    }
    runAfterPublishHooks(content, collection, afterPluginId, pluginInvocationId) {
        this.runDeferredContentHook("content:afterPublish", content, collection, afterPluginId, pluginInvocationId);
    }
    runAfterUnpublishHooks(content, collection, afterPluginId, pluginInvocationId) {
        this.runDeferredContentHook("content:afterUnpublish", content, collection, afterPluginId, pluginInvocationId);
    }
    runAfterRestoreHooks(content, collection, afterPluginId, pluginInvocationId) {
        this.runDeferredContentHook("content:afterRestore", content, collection, afterPluginId, pluginInvocationId);
    }
    runAfterScheduleHooks(content, collection, afterPluginId, pluginInvocationId) {
        this.runDeferredContentHook("content:afterSchedule", content, collection, afterPluginId, pluginInvocationId);
    }
    runAfterUnscheduleHooks(content, collection, afterPluginId, pluginInvocationId) {
        this.runDeferredContentHook("content:afterUnschedule", content, collection, afterPluginId, pluginInvocationId);
    }
    async handleSandboxedRoute(plugin, path, request, body, routeMeta, user, ui, invalidateContentCache) {
        const routeName = path.replace(LEADING_SLASH_PATTERN, "");
        try {
            const declaredHeaders = routeMeta.request ? (routeMeta.request.headers ?? []) : undefined;
            const headers = sanitizeHeadersForSandbox(request.headers, declaredHeaders);
            const meta = extractRequestMeta(request, this.config);
            const result = await plugin.invokeRoute(routeName, body, {
                url: request.url,
                method: request.method,
                headers,
                meta,
                user,
                ui,
            }, { invalidateContentCache });
            return { success: true, data: result };
        }
        catch (error) {
            if (error instanceof PluginRouteRequestError) {
                return {
                    success: false,
                    status: error.status,
                    error: { code: "INVALID_PLUGIN_REQUEST", message: error.message },
                };
            }
            console.error(`EmDash: Sandboxed plugin route error:`, error);
            const sandboxRouteError = getSandboxRouteErrorDetails(error);
            if (sandboxRouteError) {
                return {
                    success: false,
                    status: sandboxRouteError.status,
                    error: {
                        code: sandboxRouteError.code,
                        message: sandboxRouteError.message,
                    },
                };
            }
            return {
                success: false,
                error: {
                    code: "ROUTE_ERROR",
                    message: error instanceof Error ? error.message : String(error),
                },
            };
        }
    }
    // =========================================================================
    // Public Page Contributions
    // =========================================================================
    /**
     * Cache for page contributions. Uses a WeakMap keyed on the PublicPageContext
     * object so results are collected once per page context per request, even when
     * multiple render components (EmDashHead, EmDashBodyStart, EmDashBodyEnd)
     * request contributions from the same page.
     */
    pageContributionCache = new WeakMap();
    /**
     * Collect all page contributions (metadata + fragments) in a single pass.
     * Results are cached by page context object identity.
     */
    async collectPageContributions(page) {
        const cached = this.pageContributionCache.get(page);
        if (cached)
            return cached;
        const promise = this.doCollectPageContributions(page);
        this.pageContributionCache.set(page, promise);
        return promise;
    }
    async doCollectPageContributions(page) {
        const metadata = [];
        const fragments = [];
        // Trusted plugins via HookPipeline — both metadata and fragments
        if (this.hooks.hasHooks("page:metadata")) {
            const results = await this.hooks.runPageMetadata({ page });
            for (const r of results) {
                metadata.push(...r.contributions);
            }
        }
        if (this.hooks.hasHooks("page:fragments")) {
            const results = await this.hooks.runPageFragments({ page });
            for (const r of results) {
                fragments.push(...r.contributions);
            }
        }
        return { metadata, fragments };
    }
    /**
     * Collect page metadata contributions from trusted and sandboxed plugins.
     * Delegates to the single-pass collector and returns the metadata portion.
     */
    async collectPageMetadata(page) {
        const { metadata } = await this.collectPageContributions(page);
        return metadata;
    }
    /**
     * Collect page fragment contributions from trusted plugins only.
     * Delegates to the single-pass collector and returns the fragments portion.
     */
    async collectPageFragments(page) {
        const { fragments } = await this.collectPageContributions(page);
        return fragments;
    }
    isPluginEnabled(pluginId) {
        const status = this.pluginStates.get(pluginId);
        return status === undefined || status === "active";
    }
}
/**
 * Normalize an image field value together with its `darkVariant`. The media
 * normalizer only keeps the media item's own keys, so the variant is normalized
 * separately and reattached.
 */
async function normalizeImageValue(value, getProvider) {
    const primary = await normalizePrimaryImageValue(value, getProvider);
    if (!primary || !isRecord(value) || value.darkVariant == null)
        return primary;
    const darkVariant = await normalizeMediaValue(value.darkVariant, getProvider);
    return darkVariant ? { ...primary, darkVariant } : primary;
}
/**
 * Normalize the primary image of an image field value.
 *
 * A legacy string URL that the admin upgraded to `{ id: "", src: url }` so it
 * can carry a dark variant still has to normalize as a string: as an object it
 * counts as local media, which strips `src` and leaves nothing behind. The
 * upgrade outlives the variant — an editor can add one and remove it again —
 * so the shape decides, not the presence of `darkVariant`.
 */
async function normalizePrimaryImageValue(value, getProvider) {
    if (isRecord(value) && !value.id && typeof value.src === "string" && !value.provider) {
        return normalizeMediaValue(value.src, getProvider);
    }
    return normalizeMediaValue(value, getProvider);
}
