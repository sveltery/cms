/**
 * Seed file loading
 *
 * Imports seed data from the virtual module, which embeds the user's seed file
 * (or the default seed) at Vite build time. This avoids runtime filesystem access,
 * which doesn't work in workerd/miniflare where process.cwd() returns "/".
 */
async function getSeedModule() {
    // @ts-ignore - virtual module, only available within Vite runtime
    return import("virtual:emdash/seed");
}
/**
 * Load the seed file (user seed or default).
 */
export async function loadSeed() {
    const { seed } = await getSeedModule();
    return seed;
}
/**
 * Load the user's seed file, or null if none exists.
 */
export async function loadUserSeed() {
    const { userSeed } = await getSeedModule();
    return userSeed ?? null;
}
