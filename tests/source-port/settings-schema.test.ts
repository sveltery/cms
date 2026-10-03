// Complete immutable EmDash1.1.0 source callbacks; import-only native adaptation.
// MIT Copyright2026 Cloudflare Inc.; notices/emdash-MIT.txt.
import { describe, expect, it } from "vitest";

import { settingsUpdateBody, siteSettingsSchema } from "../../src/lib/server/settings/schemas.ts";

describe("settings schemas", () => {
	it("accepts null media references as deletion requests", () => {
		expect(
			settingsUpdateBody.parse({
				logo: null,
				favicon: null,
				seo: { defaultOgImage: null },
			}),
		).toEqual({ logo: null, favicon: null, seo: { defaultOgImage: null } });
	});

	it("does not expose deletion sentinels in settings responses", () => {
		expect(siteSettingsSchema.safeParse({ logo: null }).success).toBe(false);
		expect(siteSettingsSchema.safeParse({ favicon: null }).success).toBe(false);
		expect(siteSettingsSchema.safeParse({ seo: { defaultOgImage: null } }).success).toBe(false);
	});
});
