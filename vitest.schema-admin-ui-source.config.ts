import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve, dirname } from 'node:path';
const root = import.meta.dirname;
const frozen = resolve(root, 'parity/emdash/schema-admin-ui-source/packages/admin');
export default defineConfig({
  plugins: [svelte({ configFile: false }), {
    name: 'whole-schema-ui-native-svelte-host', enforce: 'pre',
    resolveId(specifier, importer) {
      if (!importer?.startsWith(frozen) || !specifier.startsWith('.')) return;
      const target = resolve(dirname(importer), specifier).replace(/\.(tsx?|js)$/, '');
      for (const name of ['ContentTypeEditor', 'ContentTypeList', 'FieldEditor']) {
        if (target === resolve(frozen, 'src/components/' + name)) return resolve(root, 'tests/helpers/schema-ui/' + name + '.tsx');
      }
      if (target === resolve(frozen, 'src/lib/api')) return resolve(root, 'src/lib/schema-admin/client.ts');
      if (target === resolve(frozen, 'tests/utils/render')) return resolve(root, 'tests/helpers/schema-ui/dom-render.ts');
    }
  }],
  resolve: { conditions: ['browser'] }, oxc: { jsx: { runtime: 'automatic' } },
  test: { environment: 'jsdom', fileParallelism: false, setupFiles: ['tests/helpers/schema-ui/dom-setup.ts'],
    include: ['parity/emdash/schema-admin-ui-source/packages/admin/tests/components/*.test.tsx'] }
});
