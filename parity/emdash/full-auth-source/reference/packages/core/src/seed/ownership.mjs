import { OptionsRepository } from "../database/repositories/options.js";
export const AUTO_SEED_COMPLETE_OPTION = "emdash:seed_complete";
export async function claimExplicitSeedOwnership(db, seed) {
    if (!seed.collections?.length)
        return;
    await new OptionsRepository(db).set(AUTO_SEED_COMPLETE_OPTION, true);
}
