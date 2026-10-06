import { defineConfig } from 'vitest/config';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import sourceCoreConfig from './parity/emdash/full-auth-source/reference/packages/core/vitest.config.mjs';
import firstConfig from './vitest.full-auth-reference.config.ts';

const root = import.meta.dirname, reference = resolve(root, 'parity/emdash/full-auth-source/reference');
const inventory = JSON.parse(readFileSync(resolve(root, 'docs/full-auth-users-source-inventory-v2.json'), 'utf8'));
const specs = new Map<string, string>(inventory.importEdges.filter((entry: any) => entry.target && !entry.import.startsWith('.'))
  .map((entry: any) => [entry.import, entry.target]));
function emitted(source: string) { return resolve(reference, source.replace(/\.tsx?$/, '.mjs')); }
function existing(path: string) {
  const withoutExtension = path.replace(/\.(?:js|tsx?)$/, '');
  return [path, `${withoutExtension}.mjs`, resolve(withoutExtension, 'index.mjs')].find(candidate => existsSync(candidate));
}
export default defineConfig({
  // Complete unmodified Source configuration supplies its original controlled virtual fixtures.
  plugins: [...(sourceCoreConfig.plugins ?? []), { name: 'exact-source-package-exports-and-imports', enforce: 'pre', resolveId(id, importer) {
    if (specs.has(id)) return emitted(specs.get(id)!);
    if (importer?.startsWith(reference) && id.startsWith('.')) return existing(resolve(dirname(importer), id));
  } }],
  test: { ...firstConfig.test, include: [...(firstConfig.test?.include ?? []),
    'parity/emdash/full-auth-source/reference/packages/admin/tests/lib/{api-token-scopes-contract,webauthn-environment}.test.mjs' ] }
});
