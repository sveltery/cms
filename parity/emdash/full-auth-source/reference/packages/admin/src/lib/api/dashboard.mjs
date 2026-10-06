/**
 * Dashboard stats API
 */
import { i18n } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { API_BASE, apiFetch, parseApiResponse, throwResponseError } from "./client.js";
/**
 * Fetch dashboard statistics
 */
export async function fetchDashboardStats() {
    const response = await apiFetch(`${API_BASE}/dashboard`);
    return parseApiResponse(response, i18n._(msg `Failed to fetch dashboard stats`));
}
export async function dismissScheduledPolicyRejection(collection, id, revision) {
    const response = await apiFetch(`${API_BASE}/admin/scheduled-policy-rejections/${encodeURIComponent(collection)}/${encodeURIComponent(id)}?rev=${encodeURIComponent(revision)}`, { method: "DELETE" });
    if (!response.ok) {
        await throwResponseError(response, i18n._(msg `Failed to dismiss scheduled publication rejection`));
    }
}
