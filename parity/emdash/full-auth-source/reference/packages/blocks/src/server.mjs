/**
 * Server-safe exports for @emdash-cms/blocks.
 *
 * Use this entry point in plugin route handlers and other server-side code
 * that doesn't have React available. Provides builders, validation, and types
 * without importing any React components.
 */
export { blocks, elements } from "./builders.js";
export { BLOCK_RESPONSE_LIMITS, isEditorDraftPatchEffect, isSafePluginPagePath, normalizePluginPagePath, validateBlockResponse, validateBlocks, validateContentEditorActionResponse, validateContentEditorPanelInteraction, validateEditorDraftPatchEffect, } from "./validation.js";
