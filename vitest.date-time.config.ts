import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
const root = import.meta.dirname;
const frozen = resolve(root, 'parity/emdash/date-time-widgets/source/packages/admin');
export default defineConfig({
  plugins: [svelte({ configFile: false }), {
    name: 'whole-date-time-native-host', enforce: 'pre',
    resolveId(specifier, importer) {
      if (importer?.endsWith('/tests/helpers/date-time/NativeHarness.svelte') && specifier.endsWith('/PublishingDateTimeFields.svelte') && !existsSync(resolve(root, 'src/lib/ui/PublishingDateTimeFields.svelte'))) return resolve(root, 'src/lib/ui/DraftPreview.svelte');
      if (importer?.endsWith('/tests/helpers/date-time/ScalarHarness.svelte') && specifier.endsWith('/DatetimeField.svelte') && !existsSync(resolve(root, 'src/lib/ui/DatetimeField.svelte'))) return resolve(root, 'src/lib/ui/DraftPreview.svelte');
      if (specifier === 'vitest/browser') return resolve(root, 'tests/helpers/date-time/dom-user-event.ts');
      if (!importer?.startsWith(frozen) || !specifier.startsWith('.')) return;
      const target = resolve(dirname(importer), specifier).replace(/\.(tsx?|js)$/, '');
      if (target === resolve(frozen, 'src/components/PublishingDateTimeEditor')) return resolve(root, 'tests/helpers/date-time/react-bridge.ts');
      if (target === resolve(frozen, 'tests/utils/render')) return resolve(root, 'tests/helpers/date-time/dom-render.ts');
      if (target === resolve(frozen, 'src/lib/publishing-datetime')) return resolve(root, 'src/lib/ui/publishing-datetime.ts');
      if (target === resolve(frozen, 'src/lib/datetime-local')) return resolve(root, 'src/lib/ui/datetime-local.ts');
    }
  }],
  resolve: { conditions: ['browser'] }, oxc: { jsx: { runtime: 'automatic' } },
  test: { environment: 'jsdom', fileParallelism: false, setupFiles: ['tests/helpers/date-time/dom-setup.ts'], include: [
    'parity/emdash/date-time-widgets/source/packages/admin/tests/components/PublishingDateTimeEditor.test.tsx',
    'parity/emdash/date-time-widgets/source/packages/admin/tests/lib/*.test.ts',
    'tests/date-time-native/*.test.ts'
  ] }
});
