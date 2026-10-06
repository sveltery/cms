/**
 * Import system
 *
 * Provides a pluggable system for importing content from various sources.
 */
// Menu import
export { importMenusFromWxr, importMenusFromPlugin, } from "./menus.js";
// Sections import
export { importReusableBlocksAsSections } from "./sections.js";
// Comments import
export { importCommentsFromPlugin, } from "./comments.js";
// Site settings import
export { importSiteSettings, parseSiteSettingsFromPlugin, } from "./settings.js";
// Registry
export { registerSource, getSource, getAllSources, getFileSources, getUrlSources, probeUrl, clearSources, } from "./registry.js";
// SSRF protection
export { validateExternalUrl, ssrfSafeFetch, SsrfError } from "./ssrf.js";
// Sources
export { wxrSource, parseWxrDate } from "./sources/wxr.js";
export { wordpressRestSource } from "./sources/wordpress-rest.js";
export { wordpressPluginSource, createBasicAuthToken, fetchPluginMedia, fetchPluginTaxonomies, } from "./sources/wordpress-plugin.js";
// Auto-register built-in sources
import { registerSource } from "./registry.js";
import { wordpressPluginSource } from "./sources/wordpress-plugin.js";
import { wordpressRestSource } from "./sources/wordpress-rest.js";
import { wxrSource } from "./sources/wxr.js";
// Register in priority order (most specific first)
// Plugin source first - if they have our plugin, use it
registerSource(wordpressPluginSource);
registerSource(wordpressRestSource);
registerSource(wxrSource);
