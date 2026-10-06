import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import originalConfig from './parity/emdash/plugin-runtime/source/packages/core/vitest.config.ts';
import { createReferencePackageResolver } from './tests/helpers/plugin-runtime/reference-package-resolver.ts';
const root = fileURLToPath(new URL('.', import.meta.url));
const frozen = path.join(root, 'parity/emdash/plugin-runtime/source/packages/core');
const product = path.join(root, 'src/lib/server/plugins');
const referencePackage = createReferencePackageResolver(root);
export default defineConfig({
  plugins: [...(originalConfig as { plugins: any[] }).plugins, { name: 'whole-pinned-plugin-source-native-host', enforce: 'pre',
    resolveId(id, importer) {
      if (id.startsWith('#') && id !== '#node-sqlite') {
        if (id === '#api/schemas.js') return path.join(frozen, 'src/api/schemas/index.ts');
        const sourcePrefixes: Record<string,string> = { db: 'database', api: 'api', config: 'config', auth: 'auth', cache: 'cache', schema: 'schema', search: 'search', sections: 'sections', menus: 'menus', widgets: 'widgets', import: 'import', security: 'security', utils: 'utils', preview: 'preview', seed: 'seed', settings: 'settings', seo: 'seo', plugins: 'plugins', media: 'media', mcp: 'mcp', comments: 'comments', bylines: 'bylines', taxonomies: 'taxonomies', redirects: 'redirects' };
        const [, prefix, rest] = /^#([^/]+)\/(.+)$/.exec(id) ?? [];
        if (sourcePrefixes[prefix]) return path.join(frozen, 'src', sourcePrefixes[prefix], rest.replace(/\.js$/, '.ts'));
      }
      if (id === '#node-sqlite') return path.join(root, 'src/lib/server/database/node-sqlite-compat.ts');
      // Genuine complete Reference dependency acquired with ignore-scripts and
      // verified against the immutable Source lock SRI; never a product import.
      if (id === 'modern-tar' && importer?.startsWith(frozen)) return path.join(process.env.PLUGIN_REFERENCE_MODERN_TAR ?? '/tmp/plugin127-source-reference-modern-tar/package', 'dist/web/index.js');
      // Preserve the complete pinned package public entry, including imports.
      if (id === 'emdash') return path.join(frozen, 'src/index.ts');
      if (id === '@emdash-cms/plugin-types') return path.join(product, 'contracts/index.ts');
      if (id === '@emdash-cms/blocks/server') return path.join(product, 'contracts/block-server.ts');
      if (id === '@emdash-cms/blocks') return path.join(product, 'contracts/block-types.ts');
      if (id === '@emdash-cms/auth') return path.join(root, 'src/lib/server/auth/permissions.ts');
      if (id === '@emdash-cms/auth/adapters/kysely') return path.join(root, 'parity/emdash/plugin-runtime/source/packages/auth/src/adapters/kysely.ts');
      // A finite test-only package export facade points at the complete pinned
      // config authority; no fabricated locale functions or public-index identity.
      if (id === '@emdash-cms/admin/locales') return path.join(root, 'parity/emdash/plugin-runtime/source/packages/admin/src/locales/config.ts');
      if (id === '@emdash-cms/admin/slugify') return path.join(root, 'src/lib/server/database/lifecycle/upstream/admin-slugify.ts');
      if (id === 'astro/zod') return this.resolve('zod', importer, { skipSelf: true });
      const referenceEntry = referencePackage(id, importer);
      if (referenceEntry) return referenceEntry;
      // Exact Original controlled collaborators. These whole frozen repositories
      // never enter the product bundle; their use grants no canonical Native credit.
      if (importer?.startsWith(product) && id.startsWith('.')) {
        const target = path.relative(product, path.resolve(path.dirname(importer), id)).replaceAll(path.sep, '/');
        const controlled: Record<string, string> = {
          'native-schema.ts': 'schema/registry.ts', 'native-users.ts': 'database/repositories/user.ts',
          'native-media.ts': 'database/repositories/media.ts', 'native-comments.ts': 'database/repositories/comment.ts',
          'native-taxonomies.ts': 'database/repositories/taxonomy.ts',
          'native-content.ts': 'database/repositories/content.ts', 'native-revisions.ts': 'database/repositories/revision.ts',
          '../database/lifecycle/upstream/database/repositories/content.ts': 'database/repositories/content.ts',
          '../database/lifecycle/upstream/database/repositories/revision.ts': 'database/repositories/revision.ts',
          '../seo/repository.ts': 'database/repositories/seo.ts',
          '../redirects/handlers.ts': 'api/handlers/redirects.ts',
          '../redirects/repository.ts': 'database/repositories/redirect.ts',
          '../redirects/schemas.ts': 'api/schemas/redirects.ts',
          '../taxonomies/definitions.ts': 'database/repositories/taxonomy-def.ts',
          '../bylines/credits.ts': 'bylines/credits.ts',
          '../menus/i18n-config.ts': 'i18n/config.ts',
          '../menus/i18n-resolve.ts': 'i18n/resolve.ts',
          'native-media-handlers.ts': 'api/handlers/media.ts', 'native-taxonomy-handlers.ts': 'api/handlers/taxonomies.ts',
          'content-usage-refresh.ts': 'media/usage/content-refresh.ts',
          '../entry-locks/repository.ts': 'database/repositories/entry-locks.ts',
          '../general-media/upstream/api/handlers/media-allowlist.ts': 'api/handlers/media-allowlist.ts',
          '../general-media/upstream/api/schemas/media.ts': 'api/schemas/media.ts',
          '../general-media/upstream/media/enrich.ts': 'media/enrich.ts',
          '../general-media/upstream/media/mime.ts': 'media/mime.ts',
          '../general-media/upstream/media/focal-point.ts': 'media/focal-point.ts'
        };
        if (controlled[target]) return path.join(frozen, 'src', controlled[target]);
      }
      if (!importer?.startsWith(frozen) || !id.startsWith('.')) return;
      const target = path.resolve(path.dirname(importer), id);
      const relative = path.relative(frozen, target).replaceAll(path.sep, '/');
      const originalControlledExtensions = new Set(['src/plugins/index.js', 'src/plugins/sandbox/proxy.js', 'src/plugins/sandbox/types.js', 'src/plugins/sandbox/runner-options.js', 'src/plugins/sandbox/index.js', 'src/plugins/sandbox/noop.js', 'src/plugins/adapt-sandbox-entry.js', 'src/plugins/marketplace.js']);
      if (originalControlledExtensions.has(relative)) return path.join(frozen, relative.replace(/\.js$/, '.ts'));
      if (relative.startsWith('src/plugins/')) return path.join(product, relative.slice('src/plugins/'.length).replace(/\.js$/, '.ts'));
      const native: Record<string, string> = {
        'src/database/repositories/plugin-storage.js': 'src/lib/server/plugins/storage-repository.ts',
        'src/database/validate.js': 'src/lib/server/database/lifecycle/upstream/database/validate.ts',
        'src/config/secrets.js': 'src/lib/server/plugins/configuration-secrets.ts',
        'src/api/handlers/plugins.js': 'src/lib/server/plugins/handlers.ts',
        'src/api/handlers/plugin-settings.js': 'src/lib/server/plugins/settings-handlers.ts',
        'src/auth/trusted-proxy.js': 'src/lib/server/comments/upstream/auth/trusted-proxy.ts'
      };
      if (native[relative]) return path.join(root, native[relative]);
    }
  }],
  test: { globals: true, environment: 'node', fileParallelism: false, include: [
    'parity/emdash/plugin-runtime/source/packages/core/tests/unit/api/plugin-settings-handlers.test.ts',
    'parity/emdash/plugin-runtime/source/packages/core/tests/integration/plugins/*.test.ts',
    'parity/emdash/plugin-runtime/source/packages/core/tests/integration/runtime/plugin-*.test.ts',
    'parity/emdash/plugin-runtime/source/packages/core/tests/unit/plugins/{define-plugin,capability-normalization,content-policy,hooks,exclusive-hooks,pipeline-rebuild,manager,state,settings,storage-query,storage-indexes,plugin-storage,cron-schedule,node-cron-scheduler,field-widgets,email-pipeline,editor-draft,route-wire,routes,request-meta,standard-format,page-context,page-contribution-sandbox,page-fragments,page-hooks-execution,page-metadata,page-seo,restore-hooks,schedule-hooks,unpublish-hooks,publication-policy-effective-draft,kv-access-list,plugin-storage-pagination,redirect-types,storage-update,save-rejection}.test.ts'
  ] }
});
