import { defineConfig } from 'vitest/config';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const root = import.meta.dirname;
const reference = resolve(root, 'parity/emdash/full-auth-source/reference');
function existing(path: string) {
  return [path, path.replace(/\.(?:js|tsx?)$/, '.mjs'), `${path}.mjs`, resolve(path, 'index.mjs')].find(candidate => existsSync(candidate));
}
export default defineConfig({
  plugins: [{ name: 'complete-source-reference-module-resolution', enforce: 'pre', resolveId(id, importer) {
    if (id === '@emdash-cms/auth') return resolve(reference, 'packages/auth/src/index.mjs');
    if (id === '@emdash-cms/auth/adapters/kysely') return resolve(reference, 'packages/auth/src/adapters/kysely.mjs');
    if (id === '@emdash-cms/auth/oauth/github') return resolve(reference, 'packages/auth/src/oauth/providers/github.mjs');
    if (id === '@emdash-cms/auth/oauth/google') return resolve(reference, 'packages/auth/src/oauth/providers/google.mjs');
    if (id.startsWith('#api/')) return existing(resolve(reference, 'packages/core/src/api', id.slice(5)));
    if (id.startsWith('#db/')) return existing(resolve(reference, 'packages/core/src/db', id.slice(4)));
    if (importer?.startsWith(reference) && id.startsWith('.')) return existing(resolve(dirname(importer), id));
  } }],
  test: { environment: 'node', fileParallelism: false, include: [
    'parity/emdash/full-auth-source/reference/packages/auth/**/*.test.mjs',
    'parity/emdash/full-auth-source/reference/packages/auth-atproto/**/*.test.mjs',
    'parity/emdash/full-auth-source/reference/packages/core/tests/unit/auth/**/*.test.mjs',
    'parity/emdash/full-auth-source/reference/packages/core/tests/integration/auth/**/*.test.mjs',
    'parity/emdash/full-auth-source/reference/packages/core/tests/unit/api-tokens.test.mjs',
    'parity/emdash/full-auth-source/reference/packages/core/tests/unit/middleware/{admin-public-routes,oauth-csrf,search-soft-auth,transfer-scope}.test.mjs',
    'parity/emdash/full-auth-source/reference/packages/core/tests/unit/astro/session-user.test.mjs',
    'parity/emdash/full-auth-source/reference/packages/core/tests/unit/database/migrations/{016_api_tokens,017_authorization_codes}.test.mjs'
  ] }
});
