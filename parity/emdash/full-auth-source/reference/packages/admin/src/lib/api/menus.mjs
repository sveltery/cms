/**
 * Menu management APIs.
 *
 * i18n: all endpoints accept an optional `locale`. When omitted, the server
 * returns or acts on all locales (legacy behaviour for clients that haven't
 * been updated yet).
 */
import { i18n } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { API_BASE, apiFetch, parseApiResponse, throwResponseError } from "./client.js";
function withLocale(path, locale) {
    return locale
        ? `${path}${path.includes("?") ? "&" : "?"}locale=${encodeURIComponent(locale)}`
        : path;
}
/**
 * Fetch all menus
 */
export async function fetchMenus(options = {}) {
    const response = await apiFetch(withLocale(`${API_BASE}/menus`, options.locale));
    return parseApiResponse(response, "Failed to fetch menus");
}
/**
 * Fetch a single menu with items
 */
export async function fetchMenu(name, options = {}) {
    const response = await apiFetch(withLocale(`${API_BASE}/menus/${name}`, options.locale));
    return parseApiResponse(response, "Failed to fetch menu");
}
/**
 * Create a menu
 */
export async function createMenu(input) {
    const response = await apiFetch(`${API_BASE}/menus`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    return parseApiResponse(response, "Failed to create menu");
}
/**
 * Update a menu
 */
export async function updateMenu(name, input, options = {}) {
    const response = await apiFetch(withLocale(`${API_BASE}/menus/${name}`, options.locale), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    return parseApiResponse(response, "Failed to update menu");
}
/**
 * Delete a menu
 */
export async function deleteMenu(name, options = {}) {
    const response = await apiFetch(withLocale(`${API_BASE}/menus/${name}`, options.locale), {
        method: "DELETE",
    });
    if (!response.ok)
        await throwResponseError(response, i18n._(msg `Failed to delete menu`));
}
/**
 * Create a menu item
 */
export async function createMenuItem(menuName, input, options = {}) {
    const response = await apiFetch(withLocale(`${API_BASE}/menus/${menuName}/items`, options.locale), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    return parseApiResponse(response, "Failed to create menu item");
}
/**
 * Update a menu item
 */
export async function updateMenuItem(menuName, itemId, input, options = {}) {
    const response = await apiFetch(withLocale(`${API_BASE}/menus/${menuName}/items/${itemId}`, options.locale), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    return parseApiResponse(response, "Failed to update menu item");
}
/**
 * Delete a menu item
 */
export async function deleteMenuItem(menuName, itemId, options = {}) {
    const response = await apiFetch(withLocale(`${API_BASE}/menus/${menuName}/items/${itemId}`, options.locale), { method: "DELETE" });
    if (!response.ok)
        await throwResponseError(response, i18n._(msg `Failed to delete menu item`));
}
/**
 * Reorder menu items
 */
export async function reorderMenuItems(menuName, input, options = {}) {
    const response = await apiFetch(withLocale(`${API_BASE}/menus/${menuName}/reorder`, options.locale), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    return parseApiResponse(response, "Failed to reorder menu items");
}
/** List every translation (locale variant) of a menu. */
export async function fetchMenuTranslations(name, options = {}) {
    const response = await apiFetch(withLocale(`${API_BASE}/menus/${name}/translations`, options.locale));
    return parseApiResponse(response, "Failed to fetch menu translations");
}
/**
 * Create a new locale translation of a menu. The new menu inherits the
 * source's items and label unless overridden.
 */
export async function createMenuTranslation(name, input, options = {}) {
    const response = await apiFetch(withLocale(`${API_BASE}/menus/${name}/translations`, options.locale), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    return parseApiResponse(response, "Failed to create menu translation");
}
