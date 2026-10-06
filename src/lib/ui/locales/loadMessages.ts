// EmDash 1.1.0 MIT, Copyright 2026 Cloudflare Inc. See notices/emdash-MIT.txt.
import type { Messages } from "@lingui/core";

import { DEFAULT_LOCALE } from "./config.js";

const LOCALE_LOADERS = import.meta.glob<{ messages: Messages }>("./catalogs/**/messages.mjs");

export async function loadMessages(locale: string): Promise<Messages> {
	const key = `./catalogs/${locale}/messages.mjs`;
	const fallbackKey = `./catalogs/${DEFAULT_LOCALE}/messages.mjs`;
	const loader = LOCALE_LOADERS[key] ?? LOCALE_LOADERS[fallbackKey];
	if (!loader) {
		throw new Error(
			`No locale catalog found for "${locale}" or "${DEFAULT_LOCALE}". Run \`pnpm locale:compile\` to generate catalogs.`,
		);
	}
	const { messages } = await loader();
	return messages;
}
