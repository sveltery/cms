// Test-only Node transport for the actual complete Source seed virtual module.
// Only the genuine virtual seed ID is handled; every other module delegates.
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';
import { generateSeedModule } from '../../scripts/source-seed-virtual-module.ts';

const publicId = 'virtual:emdash/seed';
const resolvedId = 'sveltery-source-seed:runtime-d1-fixture';
const source = generateSeedModule(fileURLToPath(new URL('../../', import.meta.url)));
registerHooks({
  resolve(specifier, context, nextResolve) {
    return specifier === publicId ? { url: resolvedId, shortCircuit: true } : nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    return url === resolvedId ? { format: 'module', source, shortCircuit: true } : nextLoad(url, context);
  }
});
