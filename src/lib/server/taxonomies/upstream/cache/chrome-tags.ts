// EmDash 1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; blob 191d09bcf3eff9337068d602671ce8adf1d5d253.
// Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
// Host transformations: TS specifiers, CMS system namespace, explicit native seams.
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
