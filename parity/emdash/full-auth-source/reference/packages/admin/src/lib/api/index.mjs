/**
 * API client for EmDash admin
 *
 * Re-exports all API modules for backwards compatibility.
 */
// Base client and shared types
export { API_BASE, ApiResponseError, apiFetch, isTerminalRequestError, parseApiResponse, throwResponseError, fetchManifest, fetchAuthMode, } from "./client.js";
// Content CRUD and revisions
export { getDraftStatus, fetchContentList, fetchContentAuthors, fetchContent, fetchTranslations, createContent, updateContent, deleteContent, fetchTrashedContent, restoreContent, permanentDeleteContent, duplicateContent, scheduleContent, unscheduleContent, getPreviewUrl, publishContent, unpublishContent, discardDraft, compareRevisions, fetchRevisions, fetchRevision, restoreRevision, } from "./content.js";
// Media
export { MEDIA_SEARCH_MAX_LENGTH, fetchMediaList, fetchMediaItem, fetchMediaUsageDetails, MediaUsageAccessDeniedError, fetchMediaFolders, fetchMediaFolder, createMediaFolder, renameMediaFolder, deleteMediaFolder, uploadMedia, replaceMediaImage, deleteMedia, updateMedia, fetchMediaProviders, fetchProviderMedia, uploadToProvider, deleteFromProvider, } from "./media.js";
// Schema (Content Type Builder)
export { fetchCollections, fetchCollection, createCollection, updateCollection, deleteCollection, fetchFields, createField, updateField, deleteField, reorderFields, reorderCollections, fetchOrphanedTables, registerOrphanedTable, fetchBlockTypes, } from "./schema.js";
// Plugins
export { fetchPlugins, fetchPlugin, fetchPluginSettings, updatePluginSettings, enablePlugin, disablePlugin, setPluginMcpEnabled, } from "./plugins.js";
// Settings
export { fetchSettings, updateSettings, } from "./settings.js";
// Users, passkeys, allowed domains
export { fetchUsers, fetchUser, updateUser, sendRecoveryLink, disableUser, enableUser, inviteUser, validateInviteToken, fetchPasskeys, renamePasskey, deletePasskey, fetchAllowedDomains, createAllowedDomain, updateAllowedDomain, deleteAllowedDomain, requestSignup, verifySignupToken, completeSignup, hasAllowedDomains, } from "./users.js";
// Bylines
export { fetchBylines, fetchByline, createByline, updateByline, deleteByline, fetchBylineTranslations, createBylineTranslation, } from "./bylines.js";
// Byline custom-field schema (Discussion #1174)
export { listBylineFields, getBylineFieldUsage, createBylineField, updateBylineField, deleteBylineField, reorderBylineFields, } from "./byline-fields.js";
// Menus
export { fetchMenus, fetchMenu, createMenu, updateMenu, deleteMenu, createMenuItem, updateMenuItem, deleteMenuItem, reorderMenuItems, fetchMenuTranslations, createMenuTranslation, } from "./menus.js";
// Widget areas
export { fetchWidgetAreas, fetchWidgetArea, createWidgetArea, deleteWidgetArea, createWidget, updateWidget, deleteWidget, reorderWidgets, fetchWidgetComponents, } from "./widgets.js";
// Sections
export { fetchSections, fetchSection, createSection, updateSection, deleteSection, } from "./sections.js";
// Taxonomies
export { fetchTaxonomyDefs, fetchTaxonomyDef, fetchTerms, createTaxonomy, createTerm, updateTerm, deleteTerm, fetchTermTranslations, createTermTranslation, } from "./taxonomies.js";
// WordPress import
export { analyzeWxr, prepareWxrImport, executeWxrImport, importWxrMedia, importWxrMediaBatched, probeImportUrl, rewriteContentUrls, analyzeWpPluginSite, executeWpPluginImport, } from "./import.js";
// API Tokens
export { API_TOKEN_SCOPES, fetchApiTokens, createApiToken, revokeApiToken, } from "./api-tokens.js";
// Comments
export { fetchComments, fetchCommentCounts, fetchComment, updateCommentStatus, deleteComment, bulkCommentAction, } from "./comments.js";
// Dashboard
export { fetchDashboardStats, } from "./dashboard.js";
// Search
export { setSearchEnabled } from "./search.js";
// Marketplace
export { searchMarketplace, fetchMarketplacePlugin, installMarketplacePlugin, updateMarketplacePlugin, uninstallMarketplacePlugin, checkPluginUpdates, CAPABILITY_LABELS, describeCapability, } from "./marketplace.js";
// Email settings
export { fetchEmailSettings, sendTestEmail, } from "./email-settings.js";
// Theme marketplace
export { searchThemes, fetchTheme, generatePreviewUrl, } from "./theme-marketplace.js";
// Redirects
export { fetchRedirects, createRedirect, updateRedirect, deleteRedirect, fetch404Summary, } from "./redirects.js";
// Current user
export { useCurrentUser } from "./current-user.js";
// Relations (reference fields)
export { createRelation, deleteRelation, fetchReferenceChildren, fetchReferenceParents, fetchRelation, fetchRelations, updateRelation, } from "./relations.js";
// Entry edit locks
export { acquireEntryLock, releaseEntryLock, entryLockRefusal, } from "./entry-lock.js";
