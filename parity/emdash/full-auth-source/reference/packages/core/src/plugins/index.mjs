/**
 * Plugin System Exports
 *
 * Unified plugin API with:
 * - Single context shape for all hooks and routes
 * - Paginated queries (no async iterators)
 * - Capability-gated APIs
 *
 */
// definePlugin
export { definePlugin, definePluginRoute } from "./define-plugin.js";
// Standard plugin adapter
export { adaptSandboxEntry } from "./adapt-sandbox-entry.js";
// Manifest validation
export { pluginManifestSchema, PLUGIN_CAPABILITIES, HOOK_NAMES } from "./manifest-schema.js";
// Request metadata
export { extractRequestMeta, sanitizeHeadersForSandbox } from "./request-meta.js";
// Context factory
export { PluginContextFactory, createPluginContext, createKVAccess, createStorageAccess, createContentAccessWithWrite, createCommentAccess, createRedirectAccess, RedirectAccessError, createSchemaAccess, createMediaAccess, createMediaAccessWithWrite, createHttpAccess, createUnrestrictedHttpAccess, createBlockedHttpAccess, createLogAccess, createUserAccess, createUrlHelper, createSiteInfo, } from "./context.js";
export { createBylineAccess } from "./byline-access.js";
export { createContentAccess } from "./content-access.js";
export { PLUGIN_HTTP_MAX_REQUEST_BYTES, PLUGIN_HTTP_MAX_RESPONSE_BYTES, bufferPluginHttpRequest, pluginHttpRedirectAction, pluginHttpResponseFromWire, pluginHttpResponseToWire, readPluginHttpBytes, rewritePluginHttpRedirect, } from "./http-wire.js";
export { CronAccessImpl } from "./cron.js";
export { DEFAULT_PLUGIN_MEDIA_READ_BYTES, MAX_PLUGIN_MEDIA_READ_BYTES, parsePluginMediaMetadataPatch, readPluginMediaBytes, toPluginMediaItem, updatePluginMediaMetadata, } from "./media.js";
// Hooks
export { HookPipeline, createHookPipeline } from "./hooks.js";
export { ContentSaveRejectedError, isContentSaveRejection } from "./save-rejection.js";
export { SCHEDULED_POLICY_REJECTION_PREFIX, isScheduledPolicyRejection, scheduledPolicyRejectionKey, } from "./content-policy.js";
// Email pipeline
export { EmailPipeline, EmailNotConfiguredError, EmailRecursionError } from "./email.js";
export { DEV_CONSOLE_EMAIL_PLUGIN_ID, getDevEmails, clearDevEmails } from "./email-console.js";
// Routes
export { PluginRouteHandler, PluginRouteRegistry, PluginRouteError, createRouteRegistry, } from "./routes.js";
// Manager
export { PluginManager, createPluginManager } from "./manager.js";
// Scheduler (Node timer-based heartbeat; consumed by the generated
// virtual:emdash/scheduler module on non-serverless adapters)
export { NodeCronScheduler } from "./scheduler/node.js";
// Sandbox
export { NoopSandboxRunner, SandboxNotAvailableError, SandboxUnavailableError, createSandboxRouteError, createSandboxRouteErrorEnvelope, getSandboxRouteErrorDetails, getSandboxRouteErrorEnvelope, MAX_SANDBOX_SAVE_REJECTION_REASON_LENGTH, SANDBOX_HOOK_RESULT_VERSION, inspectSandboxHookResult, createNoopSandboxRunner, } from "./sandbox/index.js";
export { StorageSerializationError } from "./storage-query.js";
export { PluginSettingEncryptionError, createPluginSecretRedactor, createSettingsAccess, decodePluginSettingValue, encryptPluginSetting, isEncryptedPluginSetting, } from "./settings.js";
// Capability normalization (legacy → canonical alias layer)
export { CAPABILITY_RENAMES, isDeprecatedCapability, normalizeCapability, normalizeCapabilities, normalizePluginCapabilities, } from "./types.js";
