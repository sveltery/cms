// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// Source 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e:packages/core/src/astro/integration/virtual-modules.ts; complete generateSeedModule declaration.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defaultSeed } from "../src/lib/server/seed/default.ts";

export function generateSeedModule(projectRoot: string, warnOnFallback = false): string {
	let userSeedJson: string | null = null;

	// Try .emdash/seed.json
	try {
		const seedPath = resolve(projectRoot, ".emdash", "seed.json");
		const content = readFileSync(seedPath, "utf-8");
		JSON.parse(content); // validate
		userSeedJson = content;
	} catch {
		// Not found, try next
	}

	// Try package.json → emdash.seed reference
	if (!userSeedJson) {
		try {
			const pkgPath = resolve(projectRoot, "package.json");
			const pkgContent = readFileSync(pkgPath, "utf-8");
			const pkg: { emdash?: { seed?: string } } = JSON.parse(pkgContent);

			if (pkg.emdash?.seed) {
				const seedPath = resolve(projectRoot, pkg.emdash.seed);
				const content = readFileSync(seedPath, "utf-8");
				JSON.parse(content); // validate
				userSeedJson = content;
			}
		} catch {
			// Not found
		}
	}

	// Try conventional seed/seed.json fallback
	if (!userSeedJson) {
		try {
			const seedPath = resolve(projectRoot, "seed", "seed.json");
			const content = readFileSync(seedPath, "utf-8");
			JSON.parse(content); // validate
			userSeedJson = content;
		} catch {
			// Not found
		}
	}

	if (userSeedJson) {
		return [`export const userSeed = ${userSeedJson};`, `export const seed = userSeed;`].join("\n");
	}

	// No user seed — inline the default. Caller (the Vite plugin) gates this
	// to dev-only so production builds stay quiet for sites that intentionally
	// rely on the default seed.
	if (warnOnFallback) {
		console.warn(
			"[emdash] No user seed found at .emdash/seed.json, package.json#emdash.seed, or seed/seed.json. Falling back to the built-in default seed; the setup wizard will not offer demo content for this site.",
		);
	}
	return [
		`export const userSeed = null;`,
		`export const seed = ${JSON.stringify(defaultSeed)};`,
	].join("\n");
}
