import { defineConfig } from 'vitest/config';
import { resolve, dirname } from 'node:path';
const root = import.meta.dirname;
const frozen = resolve(root, 'parity/emdash/setup-api-source/upstream/packages/core');
const host = resolve(root, 'tests/helpers/setup-api/dashboard-source-storage.ts');
const targets = new Map([
  ['src/api/handlers/dashboard.ts', 'src/lib/server/setup/dashboard/handler.ts'],
  ['src/database/repositories/content.ts', 'src/lib/server/database/lifecycle/upstream/database/repositories/content.ts'],
  ['src/database/repositories/options.ts', 'src/lib/server/options/repository.ts'],
  ['src/plugins/content-policy.ts', 'src/lib/server/setup/dashboard/content-policy.ts'],
  ['src/scheduler-health.ts', 'src/lib/server/setup/dashboard/scheduler-health.ts']
]);
export default defineConfig({
  plugins: [{
    name: 'whole-dashboard-source-real-native-storage', enforce: 'pre',
    resolveId(id, importer) {
      if (!importer?.startsWith(frozen) || !id.startsWith('.')) return;
      const target = resolve(dirname(importer), id).replace(/\.js$/, '.ts');
      if (['src/schema/registry.ts', 'tests/utils/test-db.ts']
        .some(path => target === resolve(frozen, path))) return host;
      for (const [source, native] of targets) {
        if (target === resolve(frozen, source)) return resolve(root, native);
      }
    }
  }],
  test: {
    fileParallelism: false,
    include: ['parity/emdash/setup-api-source/upstream/packages/core/tests/unit/api/dashboard-handlers.test.ts']
  }
});
