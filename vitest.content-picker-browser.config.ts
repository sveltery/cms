import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { playwright } from '@vitest/browser-playwright';
import { resolve, dirname } from 'node:path';
const root = import.meta.dirname, frozen = resolve(root, 'parity/emdash/content-picker-source/upstream/packages/admin');
export default defineConfig({ plugins: [svelte({ configFile: false }), {
  name: 'whole-content-picker-browser-native-mount', enforce: 'pre',
  resolveId(id, importer) {
    if (!importer?.startsWith(frozen) || !id.startsWith('.')) return;
    const target = resolve(dirname(importer), id).replace(/\.(tsx?|js)$/, '');
    if (target === resolve(frozen, 'src/components/ContentPickerModal')) return resolve(root, 'tests/helpers/content-picker/browser-react.tsx');
    if (target === resolve(frozen, 'src/lib/api')) return resolve(root, 'src/lib/content-picker/client.ts');
    if (target === resolve(frozen, 'tests/utils/render')) return resolve(root, 'tests/helpers/content-picker/browser-render.tsx');
  }
}], resolve: { conditions: ['browser'] }, oxc: { jsx: { runtime: 'automatic' } },
  test: { fileParallelism: false, include: ['parity/emdash/content-picker-source/upstream/packages/admin/tests/components/ContentPickerModal.test.tsx'],
    browser: { enabled: true, headless: true, provider: playwright({ launchOptions: { chromiumSandbox: true, timeout: 30000 } }),
      instances: [{ browser: 'chromium' }], viewport: { width: 1280, height: 800 } } } });
