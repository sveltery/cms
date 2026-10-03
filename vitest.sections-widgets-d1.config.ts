import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import core from './vitest.sections-widgets-core.config.ts';
const root = fileURLToPath(new URL('.', import.meta.url));
const frozen = path.join(root, 'parity/emdash/sections-widgets-source/upstream/packages/core');
const db = path.join(root, 'tests/helpers/sections-widgets/test-db-d1.ts');
export default defineConfig({ ...core, plugins: [
  { name: 'whole-sections-widgets-source-actual-raw-d1', enforce: 'pre', resolveId(id, importer) {
    if (!importer?.startsWith(frozen) || !id.startsWith('.')) return;
    const relative = path.relative(frozen, path.resolve(path.dirname(importer), id));
    if (relative === 'tests/utils/test-db.js' || relative === 'src/database/connection.js' || relative === 'src/database/migrations/runner.js') return db;
  } }, ...(core.plugins ?? [])
] });
