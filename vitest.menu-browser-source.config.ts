import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { playwright } from '@vitest/browser-playwright';
import { resolve, dirname } from 'node:path';
const root = import.meta.dirname, frozen = resolve(root, 'parity/emdash/menu-source/upstream/packages/admin');
export default defineConfig({ plugins: [svelte({ configFile: false }), {
  name: 'immutable-menu-browser-native-mount', enforce: 'pre',
  resolveId(specifier, importer) {
    if (specifier === '@cloudflare/kumo' && importer?.startsWith(frozen)) return resolve(root, 'tests/helpers/menus/browser-react.tsx');
    if (!importer?.startsWith(frozen) || !specifier.startsWith('.')) return;
    const target = resolve(dirname(importer), specifier).replace(/\.(tsx?|js)$/, '');
    if (target === resolve(frozen, 'src/components/MenuList') || target === resolve(frozen, 'src/components/MenuEditor')) return resolve(root, 'tests/helpers/menus/browser-react.tsx');
    if (target === resolve(frozen, 'src/lib/api')) return resolve(root, 'src/lib/menus/client.ts');
    if (target === resolve(frozen, 'tests/utils/render')) return resolve(root, 'tests/helpers/menus/browser-render.ts');
  }
}], resolve: { conditions: ['browser'] }, oxc: { jsx: { runtime: 'automatic' } },
  test: { fileParallelism: false, include: ['parity/emdash/menu-source/upstream/packages/admin/tests/components/MenuList.test.tsx', 'parity/emdash/menu-source/upstream/packages/admin/tests/components/MenuEditor.test.tsx'],
    browser: { enabled: true, headless: true, provider: playwright({ launchOptions: { chromiumSandbox: true, timeout: 30000 } }),
      instances: [{ browser: 'chromium' }], viewport: { width: 1280, height: 800 } } } });
