/**
 * Email settings API client functions
 */
import { i18n } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { API_BASE, apiFetch, parseApiResponse } from "./client.js";
// =============================================================================
// API functions
// =============================================================================
export async function fetchEmailSettings() {
    const res = await apiFetch(`${API_BASE}/settings/email`);
    return parseApiResponse(res, i18n._(msg `Failed to fetch email settings`));
}
export async function sendTestEmail(to) {
    const res = await apiFetch(`${API_BASE}/settings/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to }),
    });
    return parseApiResponse(res, i18n._(msg `Failed to send test email`));
}
