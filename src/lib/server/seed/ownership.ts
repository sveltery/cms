// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// Source 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e:packages/core/src/seed/ownership.ts; complete import-adapted body.
import type { Kysely } from "kysely";

import { OptionsRepository } from "../options/repository.ts";
import type { Database } from "../canonical-storage/types.ts";
import type { SeedFile } from "./types.ts";

export const AUTO_SEED_COMPLETE_OPTION = "emdash:seed_complete";

export async function claimExplicitSeedOwnership(
	db: Kysely<Database>,
	seed: SeedFile,
): Promise<void> {
	if (!seed.collections?.length) return;
	await new OptionsRepository(db).set(AUTO_SEED_COMPLETE_OPTION, true);
}
