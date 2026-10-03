// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// Immutable EmDash1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; source packages/core/src/media/usage/site-settings.ts; blob f2228d1db7a54171cb4d55a6e4c441c908869331.
/**
 * Media references held by site settings.
 *
 * Usage reads parse these from the stored `site:*` options on every read, so
 * a change through any writer of those options shows up on the next read.
 */

import { settingMediaIds, type PortableSettingName } from "../../transfer/format/settings.ts";

export const MEDIA_USAGE_SITE_SETTINGS = ["logo", "favicon", "seo.defaultOgImage"] as const;

export type MediaUsageSiteSetting = (typeof MEDIA_USAGE_SITE_SETTINGS)[number];

/**
 * One setting per option, which holds while each option has a single path in
 * `SETTING_MEDIA_REFERENCE_PATHS`. A second path needs a setting of its own.
 */
const SITE_SETTING_OPTIONS = [
	["site:logo", "logo"],
	["site:favicon", "favicon"],
	["site:seo", "seo.defaultOgImage"],
] as const satisfies readonly (readonly [PortableSettingName, MediaUsageSiteSetting])[];

export const MEDIA_USAGE_SITE_SETTING_OPTIONS = SITE_SETTING_OPTIONS.map(([option]) => option);

/**
 * Group the site settings that select each media item, in settings order.
 *
 * @param options Raw JSON option values keyed by option name.
 */
export function groupSiteSettingMediaUsage(
	options: ReadonlyMap<string, string | null>,
): Map<string, MediaUsageSiteSetting[]> {
	const usage = new Map<string, MediaUsageSiteSetting[]>();
	for (const [option, setting] of SITE_SETTING_OPTIONS) {
		for (const mediaId of settingMediaIds(option, parseOption(options.get(option)))) {
			const settings = usage.get(mediaId);
			if (settings) settings.push(setting);
			else usage.set(mediaId, [setting]);
		}
	}
	return usage;
}

function parseOption(value: string | null | undefined): unknown {
	if (value == null) return undefined;
	try {
		return JSON.parse(value);
	} catch {
		return undefined;
	}
}
