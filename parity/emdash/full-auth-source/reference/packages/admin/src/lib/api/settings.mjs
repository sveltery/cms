/**
 * Site settings APIs
 */
import { i18n } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { API_BASE, apiFetch, parseApiResponse } from "./client.js";
/**
 * Fetch site settings
 */
export async function fetchSettings() {
    const response = await apiFetch(`${API_BASE}/settings`);
    return parseApiResponse(response, i18n._(msg `Failed to fetch settings`));
}
/**
 * Update site settings
 */
export async function updateSettings(settings) {
    const response = await apiFetch(`${API_BASE}/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
    });
    return parseApiResponse(response, i18n._(msg `Failed to update settings`));
}
