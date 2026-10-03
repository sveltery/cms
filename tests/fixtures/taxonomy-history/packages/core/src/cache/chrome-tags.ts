// @ts-nocheck -- immutable source fixture; host seams are checked separately.
// Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
/**
 * Stable cache tags for EmDash chrome (settings, menus, taxonomies, widget areas).
 *
 * These tags are used by both the public read helpers (cacheHint) and the
 * admin write routes (cache.invalidate), closing the Workers edge cache loop.
 */

const PREFIX = "emdash";

export function siteSettingsTag(): string {
	return `${PREFIX}:settings`;
}

export function menuTag(name: string): string {
	return `${PREFIX}:menu:${name}`;
}

export function taxonomyTag(name: string): string {
	return `${PREFIX}:taxonomy:${name}`;
}

export function widgetAreaTag(name: string): string {
	return `${PREFIX}:widget-area:${name}`;
}
