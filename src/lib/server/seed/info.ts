// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// Source 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e:packages/core/src/astro/routes/api/setup/status.ts; complete seed and seedInfo declarations.
import { loadUserSeed } from './load.ts';

/** Native route invokes this projection after its existing setup guards. */
export async function setupSeedInfo() {
		const seed = await loadUserSeed();
		const seedInfo = seed
			? {
					name: seed.meta?.name || "Unknown Template",
					description: seed.meta?.description || "",
					collections: seed.collections?.length || 0,
					hasContent: !!(seed.content && Object.keys(seed.content).length > 0),
					title: seed.settings?.title,
					tagline: seed.settings?.tagline,
				}
			: null;
		return seedInfo;
}
