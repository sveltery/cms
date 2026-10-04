import { defineConfig } from 'vitest/config';
import path from 'node:path';

const root = import.meta.dirname;
const frozen = path.join(root, 'parity/emdash/scheduled-publishing-source/upstream');
const sourceHost = path.join(root, 'tests/helpers/calendar/source-host.ts');
const product = path.join(root, 'src/lib/server/database/lifecycle/upstream');
export default defineConfig({
  plugins: [{
    name: 'whole-calendar-source-native-node-host', enforce: 'pre',
    resolveId(id, importer) {
      if (id === '#node-sqlite' && importer?.startsWith(frozen)) return path.join(root, 'src/lib/server/database/node-sqlite-compat.ts');
      if (id === '$app/paths') return '\0calendar-native-base';
      if (id === '@emdash-cms/auth' && importer?.startsWith(frozen)) return path.join(root, 'tests/helpers/calendar/auth-reference.ts');
      if (!importer?.startsWith(frozen) || !id.startsWith('.')) return;
      const target = path.resolve(path.dirname(importer), id).replace(/\.js$/, '.ts');
      const relative = path.relative(frozen, target).replaceAll(path.sep, '/');
      const map: Record<string, string> = {
        'packages/core/src/astro/routes/api/calendar.ts': path.join(root, 'tests/helpers/calendar/source-route.ts'),
        'packages/core/src/database/migrations/runner.ts': sourceHost,
        'packages/core/src/database/dialect-helpers.ts': path.join(product, 'database/dialect-helpers.ts'),
        'packages/core/src/api/handlers/calendar.ts': path.join(root, 'src/lib/server/calendar/handlers.ts'),
        'packages/core/src/database/repositories/content.ts': path.join(product, 'database/repositories/content.ts'),
        'packages/core/src/database/repositories/types.ts': path.join(product, 'database/repositories/types.ts'),
        'packages/core/src/schema/registry.ts': sourceHost,
        'packages/core/tests/utils/test-db.ts': sourceHost,
        'packages/admin/src/lib/calendar': path.join(root, 'src/lib/calendar/calendar.ts'),
        'packages/admin/src/lib/calendar.ts': path.join(root, 'src/lib/calendar/calendar.ts'),
        'packages/admin/src/lib/api/calendar': path.join(root, 'src/lib/calendar/api.ts'),
        'packages/admin/src/lib/api/calendar.ts': path.join(root, 'src/lib/calendar/api.ts')
      };
      return map[relative];
    },
    load(id) { if (id === '\0calendar-native-base') return "export const base = '';"; }
  }],
  test: {
    environment: 'node', fileParallelism: false,
    setupFiles: ['tests/helpers/calendar/node-setup.ts'],
    include: [
      'parity/emdash/scheduled-publishing-source/upstream/packages/core/tests/unit/api/calendar-handlers.test.ts',
      'parity/emdash/scheduled-publishing-source/upstream/packages/admin/tests/lib/calendar.test.ts',
      'tests/scheduling-native/calendar.test.ts',
      'parity/emdash/scheduled-publishing-source/upstream/packages/core/tests/unit/astro/calendar-route.test.ts',
      'parity/emdash/scheduled-publishing-source/upstream/packages/core/tests/integration/database/scheduled-publish-plan.test.ts'
    ]
  }
});
