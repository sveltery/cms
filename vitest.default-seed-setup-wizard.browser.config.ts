import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { playwright } from '@vitest/browser-playwright';
import { transformAsync } from '@babel/core';
import { makeConfig } from '@lingui/conf';
import { resolve, dirname } from 'node:path';

const root = import.meta.dirname;
const frozen = resolve(root, 'parity/emdash/default-seed-setup-runtime/source/packages/admin');
const linguiConfig = makeConfig({ locales: ['en'], sourceLocale: 'en', catalogs: [] });
export default defineConfig({
  plugins: [svelte({ configFile: false, compilerOptions: { experimental: { async: true } } }), {
    name: 'whole-setup-wizard-real-svelte-transport', enforce: 'pre',
    async transform(code, id) {
      if (id.startsWith(frozen) && /\.[jt]sx?$/.test(id)) {
        const result = await transformAsync(code, { filename: id, configFile: false, babelrc: false,
          plugins: [['@lingui/babel-plugin-lingui-macro', { stripMessageField: false, linguiConfig }]],
          parserOpts: { plugins: ['typescript', 'jsx'] } });
        return result?.code ? { code: result.code, map: result.map } : null;
      }
    },
    resolveId(specifier, importer) {
      if (!importer?.startsWith(frozen) || !specifier.startsWith('.')) return;
      const target = resolve(dirname(importer), specifier).replace(/\.(tsx?|js)$/, '');
      if (target === resolve(frozen, 'src/components/SetupWizard')) return resolve(root, 'tests/helpers/default-seed-setup/wizard-react.tsx');
    }
  }],
  resolve: { conditions: ['browser'], dedupe: ['react', 'react-dom'], alias: {
    '$lib/auth.remote': resolve(root, 'tests/helpers/default-seed-setup/auth-remotes.ts'),
    '$lib/ui/PasskeySetup.svelte': resolve(root, 'src/lib/ui/PasskeySetup.svelte'),
    '$lib/ui/SetupWizard.svelte': resolve(root, 'src/lib/ui/SetupWizard.svelte'),
    '$lib/auth/passkey-browser': resolve(root, 'src/lib/auth/passkey-browser.ts'),
    '$lib/setup/client': resolve(root, 'tests/helpers/default-seed-setup/setup-client.ts'),
    '$lib/setup/navigation': resolve(root, 'tests/helpers/default-seed-setup/setup-navigation.ts'),
    '$lib/setup/providers': resolve(root, 'tests/helpers/default-seed-setup/setup-providers.ts'),
    '$app/paths': resolve(root, 'tests/helpers/schema-ui/kit-paths.ts')
  } },
  // Explicit frozen framework dependencies avoid discovery re-optimization while
  // the whole Original file awaits its mocked API/provider imports.
  optimizeDeps: { noDiscovery: true, include: [
    'react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime',
    '@lingui/core', '@lingui/react', '@tanstack/react-query', 'vitest-browser-react'
  ] },
  oxc: { jsx: { runtime: 'automatic' } },
  test: { globals: true, fileParallelism: false,
    include: ['parity/emdash/default-seed-setup-runtime/source/packages/admin/tests/components/SetupWizard.test.tsx'],
    setupFiles: ['parity/emdash/default-seed-setup-runtime/source/packages/admin/tests/setup.ts'],
    browser: { enabled: true, headless: true,
      provider: playwright({ launchOptions: { chromiumSandbox: true, timeout: 30000 }, contextOptions: { timezoneId: 'America/New_York' } }),
      instances: [{ browser: 'chromium' }], viewport: { width: 1280, height: 800 } }
  }
});
