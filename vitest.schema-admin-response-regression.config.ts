import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
const local = (name: string) => fileURLToPath(new URL(name, import.meta.url));
const authority = local('./tests/schema-admin-completion/candidate-authorities/response-contracts-r1.ts');
export default defineConfig({
  plugins: [{
    name: 'exact-r1-response-validator-public-constant-imports', enforce: 'pre',
    resolveId(id, importer) {
      if (importer?.split('?')[0] !== authority) return null;
      if (id === './types.ts') return local('./src/lib/server/schema/types.ts');
      if (id === './block-types.ts') return local('./src/lib/server/schema/block-types.ts');
      return null;
    }
  }],
  test: { environment: 'node', fileParallelism: false,
    include: ['tests/schema-admin-completion/native/response-finite.test.ts'] }
});
