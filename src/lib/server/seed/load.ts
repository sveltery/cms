// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// Source 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e:packages/core/src/seed/load.ts; complete import-adapted body.
/**
 * Seed file loading
 *
 * Imports seed data from the virtual module, which embeds the user's seed file
 * (or the default seed) at Vite build time. This avoids runtime filesystem access,
 * which doesn't work in workerd/miniflare where process.cwd() returns "/".
 */

import type { SeedFile } from "./types.ts";

interface SeedModule {
	seed: SeedFile;
	userSeed: SeedFile | null;
}

async function getSeedModule(): Promise<SeedModule> {
	// @ts-ignore - virtual module, only available within Vite runtime
	return import("virtual:emdash/seed") as Promise<SeedModule>;
}

/**
 * Load the seed file (user seed or default).
 */
export async function loadSeed(): Promise<SeedFile> {
	const { seed } = await getSeedModule();
	return seed;
}

/**
 * Load the user's seed file, or null if none exists.
 */
export async function loadUserSeed(): Promise<SeedFile | null> {
	const { userSeed } = await getSeedModule();
	return userSeed ?? null;
}
