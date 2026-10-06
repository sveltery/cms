/**
 * Plugin management APIs
 */
import { i18n } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { API_BASE, apiFetch, parseApiResponse, throwResponseError } from "./client.js";
/**
 * Fetch all plugins
 */
export async function fetchPlugins() {
    const response = await apiFetch(`${API_BASE}/admin/plugins`);
    const result = await parseApiResponse(response, i18n._(msg `Failed to fetch plugins`));
    return result.items;
}
/**
 * Fetch a single plugin
 */
export async function fetchPlugin(pluginId) {
    const response = await apiFetch(`${API_BASE}/admin/plugins/${pluginId}`);
    if (!response.ok) {
        if (response.status === 404) {
            throw new Error(i18n._(msg `Plugin "${pluginId}" not found`));
        }
        await throwResponseError(response, i18n._(msg `Failed to fetch plugin`));
    }
    const result = await parseApiResponse(response, i18n._(msg `Failed to fetch plugin`));
    return result.item;
}
/**
 * Fetch a plugin's settings schema and current values
 */
export async function fetchPluginSettings(pluginId) {
    const response = await apiFetch(`${API_BASE}/admin/plugins/${pluginId}/settings`);
    return parseApiResponse(response, i18n._(msg `Failed to fetch plugin settings`));
}
/**
 * Update a plugin's settings. Only keys present in `values` are written;
 * `null` clears a stored value (reverting to the schema default).
 */
export async function updatePluginSettings(pluginId, values) {
    const response = await apiFetch(`${API_BASE}/admin/plugins/${pluginId}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values }),
    });
    return parseApiResponse(response, i18n._(msg `Failed to update plugin settings`));
}
/**
 * Enable a plugin
 */
export async function enablePlugin(pluginId) {
    const response = await apiFetch(`${API_BASE}/admin/plugins/${pluginId}/enable`, {
        method: "POST",
    });
    const result = await parseApiResponse(response, i18n._(msg `Failed to enable plugin`));
    return result.item;
}
/**
 * Disable a plugin
 */
export async function disablePlugin(pluginId) {
    const response = await apiFetch(`${API_BASE}/admin/plugins/${pluginId}/disable`, {
        method: "POST",
    });
    const result = await parseApiResponse(response, i18n._(msg `Failed to disable plugin`));
    return result.item;
}
export async function setPluginMcpEnabled(pluginId, enabled) {
    const response = await apiFetch(`${API_BASE}/admin/plugins/${pluginId}/mcp`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
    });
    if (!response.ok) {
        await throwResponseError(response, i18n._(msg `Failed to update plugin MCP access`));
    }
}
