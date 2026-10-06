import type { Plugin } from 'vite';
import { generateSeedModule } from './source-seed-virtual-module.ts';

/** Native Vite substitution for Source's seed-only virtual-module wiring. */
export function sourceSeedPlugin(): Plugin {
  let root: string;
  let warnOnFallback = false;
  const publicId = 'virtual:emdash/seed', resolvedId = '\0' + publicId;
  return {
    name: 'sveltery-source-seed',
    enforce: 'pre',
    configResolved(configuration) { root = configuration.root; warnOnFallback = configuration.command === 'serve'; },
    resolveId(id) { if (id === publicId) return resolvedId; },
    load(id) { if (id === resolvedId) return generateSeedModule(root, warnOnFallback); }
  };
}
