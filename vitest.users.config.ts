import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('.', import.meta.url));
const frozen = path.join(root, 'parity/emdash/users/source');
export default defineConfig({
  resolve: { alias: {
    '@sveltery/user-repository-under-test': path.join(root, 'src/lib/server/users/repository.ts'),
    '@sveltery/user-scopes-under-test': path.join(root, 'src/lib/server/auth/permissions.ts')
  } },
  plugins: [{ name: 'whole-source-user-contract-host', enforce: 'pre', resolveId(id, importer) {
    if (!importer?.startsWith(frozen) || !id.startsWith('.')) return;
    const relative = path.relative(frozen, path.resolve(path.dirname(importer), id)).replaceAll(path.sep, '/');
    const map: Record<string, string> = {
      'packages/auth/src/rbac.js': path.join(root, 'src/lib/server/auth/permissions.ts'),
      'packages/auth/src/types.js': path.join(root, 'src/lib/server/auth/roles.ts'),
      'packages/core/src/utils/chunks.js': path.join(root, 'src/lib/server/schema/chunks.ts'),
      'packages/core/src/database/repositories/types.js': path.join(root, 'src/lib/server/database/trash-cursor.ts')
    };
    return map[relative];
  } }],
  test: { environment: 'node', fileParallelism: false,
    include: ['parity/emdash/users/source/packages/auth/src/rbac.test.ts', 'tests/users-native/*.test.ts'] }
});
