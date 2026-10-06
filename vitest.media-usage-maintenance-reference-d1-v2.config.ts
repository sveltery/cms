// Draft V2 Source reference transport; execution requires Root qualification.
import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';
import base from './vitest.media-usage-maintenance-reference.config.ts';
const root=import.meta.dirname;
const reference=resolve(root,'parity/emdash/media-usage-maintenance-source/reference/packages/core/src');
// Exact complete five strings from pinned core/vitest.workerd.config.ts.
const virtualStubs:Record<string,string>={
  'virtual:emdash/wait-until':'export const waitUntil = undefined;',
  'virtual:emdash/scheduler':'export const createScheduler = null;',
  'virtual:emdash/config':'export default {};',
  'virtual:emdash/env':'export const env = undefined;',
  'virtual:emdash/object-cache':'export const createObjectCache = undefined; export const objectCacheConfig = {};',
};
const packageModules:Record<string,string>={
  'emdash':resolve(reference,'config/errors.ts'),
  'emdash/database/instrumentation':resolve(reference,'database/instrumentation.ts'),
  'emdash/internal/database/migration-lock':resolve(reference,'database/migration-lock.ts'),
  'kysely-d1':'/workspace/pr47-source-probe-tools/node_modules/kysely-d1/dist/index.js',
  'cloudflare:test':resolve(root,'tests/helpers/media-usage-maintenance/reference-workerd-v2-env.ts'),
  'cloudflare:workers':resolve(root,'tests/helpers/media-usage-maintenance/reference-workerd-v2-env.ts'),
};
export default defineConfig({
  ...base,
  plugins:[{name:'literal-source-isolated-platform-reference-v2',enforce:'pre',resolveId(id){
    if(Object.hasOwn(virtualStubs,id))return '\0literal-source-workerd-stub:'+id;
    // The pinned official configuration defines no dialect stub. Preserve its
    // genuine unavailable-module path, while whole Original vi.mock may define it.
    if(id==='virtual:emdash/dialect')return {id,external:true};
    return packageModules[id];
  },load(id){const prefix='\0literal-source-workerd-stub:';
    if(id.startsWith(prefix))return virtualStubs[id.slice(prefix.length)];
  }},...base.plugins!],
  test:{...base.test,environment:'node',fileParallelism:false,maxWorkers:1,isolate:true,
    testTimeout:30_000,hookTimeout:30_000,
    setupFiles:['tests/helpers/media-usage-maintenance/reference-workerd-v2-lifetime.ts'],
    include:['activation','maintenance-engine','collection-deletion'].map(name=>
      `parity/emdash/media-usage-maintenance-source/upstream/packages/core/tests/workerd/media-usage-${name}-d1.test.ts`)
      .concat('parity/emdash/media-usage-maintenance-source/upstream/packages/core/tests/workerd/collection-recreate-d1.test.ts')}
});
