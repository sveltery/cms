import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
const local = (name: string) => fileURLToPath(new URL(name, import.meta.url));
const regression = local('./tests/schema-admin-completion/native/response-finite.test.ts');
const production = local('./src/lib/server/schema/response-contracts.ts');
const authority = local('./tests/schema-admin-completion/candidate-authorities/response-contracts-r1.ts');
export default defineConfig({
  plugins: [{
    name: 'schema-response-regression-actual-product-import-transport', enforce: 'pre',
    resolveId(id, importer) {
      // The retained Native callback and R1 snapshot stay byte-exact. Every
      // regression import now resolves to the same real production module.
      if (importer?.split('?')[0] === regression && id === '../candidate-authorities/response-contracts-r1.ts')
        return production;
      if (importer?.split('?')[0] !== authority) return null;
      if (id === './types.ts') return local('./src/lib/server/schema/types.ts');
      if (id === './block-types.ts') return local('./src/lib/server/schema/block-types.ts');
      return null;
    }
  }],
  test: { environment: 'node', fileParallelism: false,
    include: ['tests/schema-admin-completion/native/response-finite.test.ts'] }
});
