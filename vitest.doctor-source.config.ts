import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const source = root + 'parity/emdash/doctor/source/packages/core/';
export default defineConfig({
  plugins: [{ name: 'whole-doctor-source-transport', enforce: 'pre',
    resolveId(id, importer) {
      if (importer?.startsWith(source) && id === '../../../src/cli/commands/doctor.js') {
        return root + 'tests/helpers/doctor/source-transport.ts';
      }
    }
  }],
  test: { environment: 'node', fileParallelism: false,
    include: ['parity/emdash/doctor/source/packages/core/tests/unit/cli/doctor.test.ts'] }
});
