/**
 * API handler implementations for EmDash REST endpoints
 *
 * Re-exports all handlers from their respective modules
 */
// Content handlers
export { handleContentList, handleContentAuthors, handleContentGet, handleContentGetIncludingTrashed, handleContentCreate, handleContentUpdate, handleContentDuplicate, handleContentDelete, handleContentRestore, handleContentPermanentDelete, handleContentListTrashed, handleContentCountTrashed, handleContentSchedule, handleContentUnschedule, handleScheduledPolicyRejection, handleContentPublish, handleContentUnpublish, handleContentCountScheduled, handleContentDiscardDraft, handleContentCompare, handleContentTranslations, } from "./content.js";
// Dashboard stats
export { handleDashboardStats, } from "./dashboard.js";
// Core update check
export { handleCoreUpdateStatus } from "./update-check.js";
// Manifest generation
export { generateManifest } from "./manifest.js";
// Revision handlers
export { handleRevisionList, handleRevisionGet, handleRevisionRestore, } from "./revision.js";
// Media handlers
export { handleMediaList, handleMediaGet, handleMediaCreate, handleMediaRegisterUpload, handleMediaUpdate, handleMediaReplaceMetadata, handleMediaDelete, } from "./media.js";
export { handleMediaFolderList, handleMediaFolderGet, handleMediaFolderCreate, handleMediaFolderUpdate, handleMediaFolderDelete, } from "./media-folders.js";
export { aggregateMediaUsageCoverageStatus, handleMediaUsageDetails, handleMediaUsageProgress, handleMediaUsageProgressAdvance, handleMediaUsageSummaries, handleMediaUsageRepair, toMediaUsageRepairResponse, } from "./media-usage.js";
export { handleMediaUsageActivationAdvance, handleMediaUsageActivationStatus, } from "./media-usage-activation.js";
export { handleMediaUsageWorkList, handleMediaUsageWorkRetry, } from "./media-usage-work.js";
// Schema handlers
export { handleSchemaCollectionList, handleSchemaCollectionGet, handleSchemaCollectionCreate, handleSchemaCollectionUpdate, handleSchemaCollectionDelete, handleSchemaFieldList, handleSchemaFieldGet, handleSchemaFieldCreate, handleSchemaFieldUpdate, handleSchemaFieldDelete, handleSchemaCollectionReorder, handleSchemaFieldReorder, handleOrphanedTableList, handleOrphanedTableRegister, } from "./schema.js";
export { handleBlockTypeList, handleBlockTypeGet, handleBlockTypeCreate, handleBlockTypeUpdate, handleBlockTypeVersionActivate, } from "./block-types.js";
// SEO handlers
export { handleSitemapData, } from "./seo.js";
// Plugin handlers
export { handlePluginList, handlePluginGet, handlePluginEnable, handlePluginDisable, } from "./plugins.js";
export { handlePluginSettingsGet, handlePluginSettingsUpdate, getPluginSettingsSchema, } from "./plugin-settings.js";
// Menu handlers
export { handleMenuList, handleMenuCreate, handleMenuGet, handleMenuUpdate, handleMenuDelete, handleMenuItemCreate, handleMenuItemUpdate, handleMenuItemDelete, handleMenuItemReorder, handleMenuSetItems, } from "./menus.js";
// Section handlers
export { handleSectionList, handleSectionCreate, handleSectionGet, handleSectionUpdate, handleSectionDelete, } from "./sections.js";
// Settings handlers
export { handleSettingsGet, handleSettingsUpdate } from "./settings.js";
// Taxonomy handlers
export { handleTaxonomyList, handleTaxonomyGet, handleTaxonomyUpdate, handleTaxonomyDelete, handleTaxonomyDefTranslations, handleTermList, handleTermCreate, handleTermGet, handleTermUpdate, handleTermDelete, } from "./taxonomies.js";
// Marketplace handlers
export { handleMarketplaceInstall, handleMarketplaceUpdate, rollbackPluginUpdate, handleMarketplaceUninstall, handleMarketplaceUpdateCheck, handleMarketplaceSearch, handleMarketplaceGetPlugin, handleThemeSearch, handleThemeGetDetail, loadBundleFromR2, } from "./marketplace.js";
// Registry handlers (experimental)
export { assertEnvCompatible, assertSafeArtifactUrl, handleRegistryInstall, handleRegistryUninstall, handleRegistryUpdate, handleRegistryUpdateCheck, } from "./registry.js";
