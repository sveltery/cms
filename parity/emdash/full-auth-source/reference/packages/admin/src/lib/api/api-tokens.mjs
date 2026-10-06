/**
 * API token management client functions
 */
import { i18n } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { API_BASE, apiFetch, parseApiResponse, throwResponseError } from "./client.js";
/**
 * Scope strings for personal API tokens (wire + UI iteration order).
 * Human-readable copy lives in `ApiTokenSettings` (`SCOPE_UI` + Lingui).
 */
export const API_TOKEN_SCOPES = {
    ContentRead: "content:read",
    ContentWrite: "content:write",
    MediaRead: "media:read",
    MediaWrite: "media:write",
    SchemaRead: "schema:read",
    SchemaWrite: "schema:write",
    TaxonomiesManage: "taxonomies:manage",
    MenusManage: "menus:manage",
    SettingsRead: "settings:read",
    SettingsManage: "settings:manage",
    McpTools: "mcp:tools",
    TransferExport: "transfer:export",
    TransferAnalyze: "transfer:analyze",
    TransferExecute: "transfer:execute",
    Admin: "admin",
};
// =============================================================================
// API Functions
// =============================================================================
/**
 * Fetch all API tokens for the current user
 */
export async function fetchApiTokens() {
    const response = await apiFetch(`${API_BASE}/admin/api-tokens`);
    const result = await parseApiResponse(response, "Failed to fetch API tokens");
    return result.items;
}
/**
 * Create a new API token
 */
export async function createApiToken(input) {
    const response = await apiFetch(`${API_BASE}/admin/api-tokens`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    return parseApiResponse(response, "Failed to create API token");
}
/**
 * Revoke (delete) an API token
 */
export async function revokeApiToken(id) {
    const response = await apiFetch(`${API_BASE}/admin/api-tokens/${id}`, {
        method: "DELETE",
    });
    if (!response.ok)
        await throwResponseError(response, i18n._(msg `Failed to revoke API token`));
}
