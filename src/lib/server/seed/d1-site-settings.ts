// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// Native D1 sequential option-domain specialization of Source settings. Native cache invalidator is shared with public media.
import type { Kysely } from 'kysely';
import { OptionsRepository } from '../comments/upstream/database/repositories/options.ts';

import type { Database } from './upstream/database/types.ts';
import type { SiteSettingsUpdate } from './settings-types.ts';
import { invalidateSiteSettingsCache } from '../general-media/cache.ts';
export { invalidateSiteSettingsCache } from '../general-media/cache.ts';
import { isRecord } from './upstream/plugin-utils.ts';

const SETTINGS_PREFIX = "site:";

const NESTED_SETTING_KEYS = new Set(["seo", "social"]);

export async function setSiteSettings(
	settings: SiteSettingsUpdate,
	db: Kysely<Database>,
): Promise<void> {
	const updates: Record<string, unknown> = {};
	const deletions: string[] = [];
	const nestedPatches: [key: string, patch: Record<string, unknown>][] = [];

	for (const [key, value] of Object.entries(settings)) {
		if (value === undefined) continue;
		if (value === null) deletions.push(`${SETTINGS_PREFIX}${key}`);
		else if (NESTED_SETTING_KEYS.has(key) && isRecord(value)) nestedPatches.push([key, value]);
		else updates[`${SETTINGS_PREFIX}${key}`] = value;
	}

	try {
		{
			const transactionOptions = new OptionsRepository(db);
			await transactionOptions.setMany(updates);
			await transactionOptions.deleteMany(deletions);

			for (const [key, patch] of nestedPatches) {
				const optionName = `${SETTINGS_PREFIX}${key}`;
				const next = { ...(await transactionOptions.get<Record<string, unknown>>(optionName)) };
				for (const [field, fieldValue] of Object.entries(patch)) {
					if (fieldValue === null) delete next[field];
					else if (fieldValue !== undefined) next[field] = fieldValue;
				}
				if (Object.keys(next).length === 0) await transactionOptions.delete(optionName);
				else await transactionOptions.set(optionName, next);
			}
		}
	} finally {
		invalidateSiteSettingsCache();
	}
}
