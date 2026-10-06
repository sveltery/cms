/**
 * Search enable/disable APIs
 */
import { i18n } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { API_BASE, apiFetch, parseApiResponse } from "./client.js";
/**
 * Enable or disable search for a collection
 */
export async function setSearchEnabled(collection, enabled, weights) {
    const response = await apiFetch(`${API_BASE}/search/enable`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collection, enabled, weights }),
    });
    const fallbackMessage = enabled
        ? i18n._(msg `Failed to enable search`)
        : i18n._(msg `Failed to disable search`);
    return parseApiResponse(response, fallbackMessage);
}
