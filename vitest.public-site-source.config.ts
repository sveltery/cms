import { defineConfig } from 'vitest/config';
import path from 'node:path';
const root = process.cwd();
const frozen = path.join(root, 'parity/emdash/public-site-renderer/source/packages/core');
export default defineConfig({
  plugins: [{ name: 'whole-public-renderer-source-boundaries', enforce: 'pre', resolveId(id, importer) {
    if (id === 'astro/container') return path.join(root, 'tests/helpers/public-site/astro-container.ts');
    if (!importer?.startsWith(frozen) || !id.startsWith('.')) return;
    const relative = path.relative(frozen, path.resolve(path.dirname(importer), id));
    if (relative === 'src/components/PortableText.astro') return path.join(root, 'tests/helpers/public-site/component.ts');
    const mappings: Record<string, string> = {
      'src/components/portable-text-text-align.js': 'portable-text-text-align.ts',
      'src/components/portable-text-blockquote-group.js': 'portable-text-blockquote-group.ts',
      'src/content/portable-text-lists.js': 'portable-text-lists.ts'
    };
    if (mappings[relative]) return path.join(root, 'src/lib/public-site', mappings[relative]);
  } }],
  test: { environment: 'node', fileParallelism: false, include: [
    'parity/emdash/public-site-renderer/source/packages/core/tests/repro/portable-text-text-align.render.test.ts',
    'parity/emdash/public-site-renderer/source/packages/core/tests/unit/components/portable-text-text-align-class.test.ts',
    'parity/emdash/public-site-renderer/source/packages/core/tests/unit/components/blockquote-group.test.ts',
    'parity/emdash/public-site-renderer/source/packages/core/tests/unit/content/portable-text-lists.test.ts'
  ] }
});
