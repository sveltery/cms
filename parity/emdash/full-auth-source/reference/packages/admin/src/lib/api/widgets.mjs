/**
 * Widget areas APIs
 */
import { i18n } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { API_BASE, apiFetch, parseApiResponse, throwResponseError } from "./client.js";
/**
 * Fetch all widget areas
 */
export async function fetchWidgetAreas() {
    const response = await apiFetch(`${API_BASE}/widget-areas`);
    const data = await parseApiResponse(response, "Failed to fetch widget areas");
    return data.items;
}
/**
 * Fetch a single widget area by name
 */
export async function fetchWidgetArea(name) {
    const response = await apiFetch(`${API_BASE}/widget-areas/${name}`);
    return parseApiResponse(response, "Failed to fetch widget area");
}
/**
 * Create a widget area
 */
export async function createWidgetArea(input) {
    const response = await apiFetch(`${API_BASE}/widget-areas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    return parseApiResponse(response, "Failed to create widget area");
}
/**
 * Delete a widget area
 */
export async function deleteWidgetArea(name) {
    const response = await apiFetch(`${API_BASE}/widget-areas/${name}`, {
        method: "DELETE",
    });
    if (!response.ok)
        await throwResponseError(response, i18n._(msg `Failed to delete widget area`));
}
/**
 * Add a widget to an area
 */
export async function createWidget(areaName, input) {
    const response = await apiFetch(`${API_BASE}/widget-areas/${areaName}/widgets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    return parseApiResponse(response, "Failed to create widget");
}
/**
 * Update a widget
 */
export async function updateWidget(areaName, widgetId, input) {
    const response = await apiFetch(`${API_BASE}/widget-areas/${areaName}/widgets/${widgetId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    return parseApiResponse(response, "Failed to update widget");
}
/**
 * Delete a widget
 */
export async function deleteWidget(areaName, widgetId) {
    const response = await apiFetch(`${API_BASE}/widget-areas/${areaName}/widgets/${widgetId}`, {
        method: "DELETE",
    });
    if (!response.ok)
        await throwResponseError(response, i18n._(msg `Failed to delete widget`));
}
/**
 * Reorder widgets in an area
 */
export async function reorderWidgets(areaName, widgetIds) {
    const response = await apiFetch(`${API_BASE}/widget-areas/${areaName}/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ widgetIds }),
    });
    if (!response.ok)
        await throwResponseError(response, i18n._(msg `Failed to reorder widgets`));
}
/**
 * Fetch available widget components
 */
export async function fetchWidgetComponents() {
    const response = await apiFetch(`${API_BASE}/widget-components`);
    const data = await parseApiResponse(response, "Failed to fetch widget components");
    return data.items;
}
