import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';
import base from './vitest.media-usage-maintenance-reference.config.ts';
const root=import.meta.dirname;
const reference=resolve(root,'parity/emdash/media-usage-maintenance-source/reference/packages/core/src');
const packageModules:Record<string,string>={
  'emdash':resolve(reference,'config/errors.ts'),
  'emdash/database/instrumentation':resolve(reference,'database/instrumentation.ts'),
  'emdash/internal/database/migration-lock':resolve(reference,'database/migration-lock.ts'),
  'kysely-d1':'/workspace/pr47-source-probe-tools/node_modules/kysely-d1/dist/index.js',
  'cloudflare:test':resolve(root,'tests/helpers/media-usage-maintenance/reference-workerd-env.ts'),
  'cloudflare:workers':resolve(root,'tests/helpers/media-usage-maintenance/reference-workerd-env.ts'),
};
export default defineConfig({
  ...base,
  plugins:[{name:'actual-platform-literal-source-reference-only',enforce:'pre',resolveId(id){return packageModules[id];}},...base.plugins!],
  test:{...base.test,environment:'node',fileParallelism:false,maxWorkers:1,isolate:false,
    setupFiles:['tests/helpers/media-usage-maintenance/reference-workerd-lifetime.ts'],
    include:['activation','maintenance-engine','collection-deletion'].map(name=>
      `parity/emdash/media-usage-maintenance-source/upstream/packages/core/tests/workerd/media-usage-${name}-d1.test.ts`)
      .concat('parity/emdash/media-usage-maintenance-source/upstream/packages/core/tests/workerd/collection-recreate-d1.test.ts')}
});
