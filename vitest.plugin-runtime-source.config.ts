import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('.', import.meta.url));
const frozen = path.join(root, 'parity/emdash/plugin-runtime/source/packages/core');
const product = path.join(root, 'src/lib/server/plugins');
export default defineConfig({
  plugins: [{ name: 'whole-pinned-plugin-source-native-host', enforce: 'pre',
    resolveId(id, importer) {
      if (id === '#node-sqlite') return path.join(root, 'src/lib/server/database/node-sqlite-compat.ts');
      if (id === '@emdash-cms/plugin-types') return path.join(product, 'contracts/index.ts');
      if (id === '@emdash-cms/auth') return path.join(root, 'src/lib/server/auth/permissions.ts');
      if (id === '@emdash-cms/admin/slugify') return path.join(root, 'src/lib/server/database/lifecycle/upstream/admin-slugify.ts');
      if (id === 'astro/zod') return this.resolve('zod', importer, { skipSelf: true });
      if (!importer?.startsWith(frozen) || !id.startsWith('.')) return;
      const target = path.resolve(path.dirname(importer), id);
      const relative = path.relative(frozen, target).replaceAll(path.sep, '/');
      if (relative.startsWith('src/plugins/')) return path.join(product, relative.slice('src/plugins/'.length).replace(/\.js$/, '.ts'));
      const native: Record<string, string> = {
        'src/database/validate.js': 'src/lib/server/database/lifecycle/upstream/database/validate.ts',
        'src/config/secrets.js': 'src/lib/server/plugins/configuration-secrets.ts',
        'src/auth/trusted-proxy.js': 'src/lib/server/comments/upstream/auth/trusted-proxy.ts'
      };
      if (native[relative]) return path.join(root, native[relative]);
    }
  }],
  test: { environment: 'node', fileParallelism: false, include: [
    'parity/emdash/plugin-runtime/source/packages/core/tests/unit/plugins/{define-plugin,capability-normalization,content-policy,hooks,exclusive-hooks,pipeline-rebuild,manager,state,settings,storage-query,storage-indexes,plugin-storage,cron-schedule,node-cron-scheduler,field-widgets,email-pipeline,editor-draft,route-wire,routes,request-meta,standard-format,page-context,page-contribution-sandbox,page-fragments,page-hooks-execution,page-metadata,page-seo,restore-hooks,schedule-hooks,unpublish-hooks,publication-policy-effective-draft,kv-access-list,plugin-storage-pagination,redirect-types,storage-update,save-rejection}.test.ts'
  ] }
});
