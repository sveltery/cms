// EmDash 1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
export interface Menu {
	id: string;
	name: string;
	label: string;
	createdAt: string;
	updatedAt: string;
	itemCount?: number;
	locale: string;
	translationGroup: string | null;
}

export interface MenuItem {
	id: string;
	menuId: string;
	parentId: string | null;
	sortOrder: number;
	type: string;
	referenceCollection: string | null;
	referenceId: string | null;
	customUrl: string | null;
	label: string;
	titleAttr: string | null;
	target: string | null;
	cssClasses: string | null;
	createdAt: string;
	locale: string;
	translationGroup: string | null;
}

export interface MenuWithItems extends Menu {
	items: MenuItem[];
}

export interface MenuTranslation {
	id: string;
	name: string;
	label: string;
	locale: string;
	updatedAt: string;
}

export interface MenuTranslationsResponse {
	translationGroup: string | null;
	translations: MenuTranslation[];
}

export interface CreateMenuInput {
	name: string;
	label: string;
	locale?: string;
	translationOf?: string;
}

export interface UpdateMenuInput {
	label?: string;
}

export interface CreateMenuItemInput {
	type: string;
	label: string;
	referenceCollection?: string;
	referenceId?: string;
	customUrl?: string;
	target?: string;
	titleAttr?: string;
	cssClasses?: string;
	parentId?: string;
	sortOrder?: number;
}

export interface UpdateMenuItemInput {
	label?: string;
	customUrl?: string;
	target?: string;
	titleAttr?: string;
	cssClasses?: string;
	parentId?: string | null;
	sortOrder?: number;
}

export interface ReorderMenuItemsInput {
	items: Array<{
		id: string;
		parentId: string | null;
		sortOrder: number;
	}>;
}

export interface LocaleOptions {
	locale?: string;
}


async function throwResponseError(response: Response, fallback: string): Promise<never> {
  const result = await response.json().catch(() => null);
  throw new Error(result?.error?.message ?? fallback);
}
async function parseApiResponse<T>(response: Response, fallback: string): Promise<T> {
  if (!response.ok) return throwResponseError(response, fallback);
  const result = await response.json(); if (!result.success) throw new Error(result.error?.message ?? fallback);
  return result.data;
}
export function createMenuClient(basePath = '', fetcher: typeof fetch = globalThis.fetch) {
  const API_BASE = `${basePath.replace(/\/$/, '')}/api`;
  const apiFetch = (url: string, options?: RequestInit) => fetcher(url, { credentials: 'same-origin', ...options });
function withLocale(path: string, locale?: string): string {
	return locale
		? `${path}${path.includes("?") ? "&" : "?"}locale=${encodeURIComponent(locale)}`
		: path;
}

/**
 * Fetch all menus
 */
async function fetchMenus(options: LocaleOptions = {}): Promise<Menu[]> {
	const response = await apiFetch(withLocale(`${API_BASE}/menus`, options.locale));
	return parseApiResponse<Menu[]>(response, "Failed to fetch menus");
}

/**
 * Fetch a single menu with items
 */
async function fetchMenu(name: string, options: LocaleOptions = {}): Promise<MenuWithItems> {
	const response = await apiFetch(withLocale(`${API_BASE}/menus/${name}`, options.locale));
	return parseApiResponse<MenuWithItems>(response, "Failed to fetch menu");
}

/**
 * Create a menu
 */
async function createMenu(input: CreateMenuInput): Promise<Menu> {
	const response = await apiFetch(`${API_BASE}/menus`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(input),
	});
	return parseApiResponse<Menu>(response, "Failed to create menu");
}

/**
 * Update a menu
 */
async function updateMenu(
	name: string,
	input: UpdateMenuInput,
	options: LocaleOptions = {},
): Promise<Menu> {
	const response = await apiFetch(withLocale(`${API_BASE}/menus/${name}`, options.locale), {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(input),
	});
	return parseApiResponse<Menu>(response, "Failed to update menu");
}

/**
 * Delete a menu
 */
async function deleteMenu(name: string, options: LocaleOptions = {}): Promise<void> {
	const response = await apiFetch(withLocale(`${API_BASE}/menus/${name}`, options.locale), {
		method: "DELETE",
	});
	if (!response.ok) await throwResponseError(response, "Failed to delete menu");
}

/**
 * Create a menu item
 */
async function createMenuItem(
	menuName: string,
	input: CreateMenuItemInput,
	options: LocaleOptions = {},
): Promise<MenuItem> {
	const response = await apiFetch(
		withLocale(`${API_BASE}/menus/${menuName}/items`, options.locale),
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(input),
		},
	);
	return parseApiResponse<MenuItem>(response, "Failed to create menu item");
}

/**
 * Update a menu item
 */
async function updateMenuItem(
	menuName: string,
	itemId: string,
	input: UpdateMenuItemInput,
	options: LocaleOptions = {},
): Promise<MenuItem> {
	const response = await apiFetch(
		withLocale(`${API_BASE}/menus/${menuName}/items/${itemId}`, options.locale),
		{
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(input),
		},
	);
	return parseApiResponse<MenuItem>(response, "Failed to update menu item");
}

/**
 * Delete a menu item
 */
async function deleteMenuItem(
	menuName: string,
	itemId: string,
	options: LocaleOptions = {},
): Promise<void> {
	const response = await apiFetch(
		withLocale(`${API_BASE}/menus/${menuName}/items/${itemId}`, options.locale),
		{ method: "DELETE" },
	);
	if (!response.ok) await throwResponseError(response, "Failed to delete menu item");
}

/**
 * Reorder menu items
 */
async function reorderMenuItems(
	menuName: string,
	input: ReorderMenuItemsInput,
	options: LocaleOptions = {},
): Promise<MenuItem[]> {
	const response = await apiFetch(
		withLocale(`${API_BASE}/menus/${menuName}/reorder`, options.locale),
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(input),
		},
	);
	return parseApiResponse<MenuItem[]>(response, "Failed to reorder menu items");
}

/** List every translation (locale variant) of a menu. */
async function fetchMenuTranslations(
	name: string,
	options: LocaleOptions = {},
): Promise<MenuTranslationsResponse> {
	const response = await apiFetch(
		withLocale(`${API_BASE}/menus/${name}/translations`, options.locale),
	);
	return parseApiResponse<MenuTranslationsResponse>(response, "Failed to fetch menu translations");
}

/**
 * Create a new locale translation of a menu. The new menu inherits the
 * source's items and label unless overridden.
 */
async function createMenuTranslation(
	name: string,
	input: { locale: string; label?: string },
	options: LocaleOptions = {},
): Promise<Menu> {
	const response = await apiFetch(
		withLocale(`${API_BASE}/menus/${name}/translations`, options.locale),
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(input),
		},
	);
	return parseApiResponse<Menu>(response, "Failed to create menu translation");
}

return { fetchMenus, fetchMenu, createMenu, updateMenu, deleteMenu, createMenuItem, updateMenuItem, deleteMenuItem, reorderMenuItems, fetchMenuTranslations, createMenuTranslation };
}
const nativeClient = createMenuClient();
export const fetchMenus = nativeClient.fetchMenus;
export const fetchMenu = nativeClient.fetchMenu;
export const createMenu = nativeClient.createMenu;
export const updateMenu = nativeClient.updateMenu;
export const deleteMenu = nativeClient.deleteMenu;
export const createMenuItem = nativeClient.createMenuItem;
export const updateMenuItem = nativeClient.updateMenuItem;
export const deleteMenuItem = nativeClient.deleteMenuItem;
export const reorderMenuItems = nativeClient.reorderMenuItems;
export const fetchMenuTranslations = nativeClient.fetchMenuTranslations;
export const createMenuTranslation = nativeClient.createMenuTranslation;
