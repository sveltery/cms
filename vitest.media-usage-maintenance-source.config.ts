import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import manifest from './parity/emdash/media-usage-maintenance-source/manifest.json' with { type: 'json' };

const root = fileURLToPath(new URL('.', import.meta.url));
const frozen = path.join(root, 'parity/emdash/media-usage-maintenance-source/upstream/packages/core');
const runtime = path.join(root, 'src/lib/server/media-usage/upstream');
export default defineConfig({
  plugins: [{ name: 'whole-immutable-media-usage-maintenance-families', enforce: 'pre',
    resolveId(id, importer) {
      if (!importer?.startsWith(frozen)) return;
      if (!id.startsWith('.')) return;
      const relative = path.relative(frozen, path.resolve(path.dirname(importer), id)).replaceAll(path.sep, '/');
      if (relative.startsWith('src/')) return path.join(runtime, relative.slice(4).replace(/\.js$/, '.ts'));
    }
  }],
  test: { environment: 'node', fileParallelism: false,
    include: manifest.records.filter(record => record.ownedWholeFamily).map(record => record.copiedPath)
  }
});
