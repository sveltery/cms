import { loadUserSeed } from './load.ts';

/** Complete Source setup/status seedInfo projection; native transport calls it after its unchanged guards. */
export async function setupSeedInfo() {
  const seed = await loadUserSeed();
  return seed
    ? {
      name: seed.meta?.name || 'Unknown Template',
      description: seed.meta?.description || '',
      collections: seed.collections?.length || 0,
      hasContent: !!(seed.content && Object.keys(seed.content).length > 0),
      title: seed.settings?.title,
      tagline: seed.settings?.tagline
    }
    : null;
}
