import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';
const root = fileURLToPath(new URL('.', import.meta.url));
const admin = resolve(root, 'parity/emdash/sections-widgets-source/upstream/packages/admin');
const helper = resolve(root, 'tests/helpers/sections-widgets/browser');
export default defineConfig({
  plugins: [
    { name: 'whole-sections-widgets-source-native-host', enforce: 'pre', resolveId(id, importer) {
      if (!importer || !id.startsWith('.')) return;
      const target = resolve(importer.split('?')[0].slice(0, importer.split('?')[0].lastIndexOf('/')), id).replace(/\.(tsx?|jsx?)$/, '');
      if (target === `${admin}/src/lib/api`) return `${root}src/lib/sections-widgets/api.ts`;
      if (['Sections', 'Widgets', 'SectionEditor', 'SectionPickerModal'].some(name => target === `${admin}/src/components/${name}`)) return `${helper}/components.tsx`;
      if (target === `${admin}/src/components/PortableTextEditor`) return `${helper}/editor-unavailable.tsx`;
      if (target === `${admin}/src/components/MediaPickerModal`) return `${helper}/media-unavailable.tsx`;
      if (target === `${admin}/dist/styles.css`) return `${root}src/lib/ui/sections-widgets/admin.css`;
    } },
    svelte({ configFile: false })
  ],
  resolve: { alias: { $lib: resolve(root, 'src/lib') }, conditions: ['browser'] },
  test: {
    include: ['parity/emdash/sections-widgets-source/upstream/packages/admin/tests/components/*.test.tsx'],
    setupFiles: ['tests/helpers/sections-widgets/browser/setup.ts'],
    fileParallelism: false,
    browser: { enabled: true, provider: playwright({ launchOptions: { chromiumSandbox: true, timeout: 30_000 } }), headless: true, instances: [{ browser: 'chromium' }] }
  }
});
