import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('.',import.meta.url));
const frozen = path.join(root,'parity/emdash/block-registry-source/executable');
const source = path.join(frozen,'packages/core');
const runtime = path.join(root,'src/lib/server/blocks/upstream');
export default defineConfig({
  plugins:[{name:'complete-original-block-registry-families',enforce:'pre',
    resolveId(id,importer) {
      if(!importer?.startsWith(frozen)) return;
      if(id === 'cloudflare:test') return path.join(root,'tests/helpers/blocks/source-d1-env.ts');
      if(!id.startsWith('.')) return;
      const resolved = path.resolve(path.dirname(importer),id);
      const relative = path.relative(source,resolved).replaceAll(path.sep,'/');
      if(relative === 'tests/utils/test-db.js' || relative === 'src/database/migrations/runner.js') return path.join(root,'tests/helpers/blocks/source-db.ts');
      if(relative === 'src/schema/registry.js') return path.join(root,'tests/helpers/blocks/source-schema-registry.ts');
      if(relative === '../cloudflare/src/db/d1-dialect.js') return path.join(root,'tests/helpers/blocks/source-d1-dialect.ts');
      if(relative === 'tests/workerd/d1-schema.js') return path.join(root,'tests/helpers/blocks/source-d1-schema.ts');
      if(relative.startsWith('src/')) return path.join(runtime,relative.slice(4).replace(/[.]js$/,'.ts'));
    }
  }],
  test:{fileParallelism:false,projects:[
    {extends:true,test:{name:'wholeSourceNodeFamiliesAndAdditionalRawD1',environment:'node',globals:true,
      include:['parity/emdash/block-registry-source/executable/packages/core/tests/integration/schema/block-type-registry.test.ts',
        'parity/emdash/block-registry-source/executable/packages/core/tests/integration/database/block-types-migration.test.ts',
        'parity/emdash/block-registry-source/executable/packages/core/tests/unit/schema/block-type-contract.test.ts']}},
    {extends:true,test:{name:'wholeOriginalSourceD1FamilyOnActualRawBinding',environment:'node',
      testTimeout:30_000,hookTimeout:30_000,
      include:['parity/emdash/block-registry-source/executable/packages/core/tests/workerd/block-type-registry-d1.test.ts']}}
  ]}

});
