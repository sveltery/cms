import { defineConfig } from 'vitest/config';
import { dirname, resolve } from 'node:path';
import { existsSync } from 'node:fs';
const root = import.meta.dirname;
const frozen = resolve(root, 'parity/emdash/entry-locks/source');
export default defineConfig({ plugins: [{ name: 'whole-entry-lock-authority-resolution', enforce: 'pre', resolveId(id, importer) {
  if (id === 'croner' && process.env.ENTRY_LOCK_REFERENCE_CRON_MODULE) return process.env.ENTRY_LOCK_REFERENCE_CRON_MODULE;
  if (id === '@emdash-cms/auth') return resolve(root, 'tests/helpers/entry-locks/source-auth.ts');
  if (id === '@emdash-cms/admin/slugify') return resolve(frozen, 'packages/admin/src/slugify.ts');
  if (id === '#api/schemas.js') return resolve(frozen, 'packages/core/src/api/schemas/index.ts');
  for (const [prefix, directory] of Object.entries({ '#api/': 'api/', '#media/': 'media/', '#utils/': 'utils/', '#cache/': 'cache/', '#db/': 'database/', '#taxonomies/': 'taxonomies/' })) {
    if (id.startsWith(prefix)) return resolve(frozen, 'packages/core/src', directory, id.slice(prefix.length).replace(/\.js$/, '.ts'));
  }
  if (id === '#node-sqlite') return resolve(root, 'src/lib/server/database/node-sqlite-compat.ts');
  if (!importer?.startsWith(frozen) || !id.startsWith('.')) return;
  const target = resolve(dirname(importer), id.replace(/\.js$/, '.ts'));
  if (existsSync(target)) return target;
} }], test: { environment: 'node', fileParallelism: false, include: [
  'parity/emdash/entry-locks/source/packages/core/tests/integration/database/entry-locks.test.ts',
  'parity/emdash/entry-locks/source/packages/core/tests/integration/content/entry-lock.test.ts',
  'parity/emdash/entry-locks/source/packages/core/tests/integration/mcp/entry-lock.test.ts',
  'parity/emdash/entry-locks/source/packages/core/tests/unit/astro/content-route-entry-lock.test.ts'
] } });
