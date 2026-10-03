import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root=fileURLToPath(new URL('.',import.meta.url));
const frozen=path.join(root,'parity/emdash/redirect-integration-source/upstream/packages/core');
export default defineConfig({
 plugins:[{
  name:'whole-pinned-redirect-integration-native-boundaries',enforce:'pre',
  resolveId(id,importer) {
   if(!importer?.startsWith(frozen)||!id.startsWith('.'))return;
   const target=path.resolve(path.dirname(importer),id);
   const aliases:Record<string,string>={
    'tests/utils/test-db.js':'tests/helpers/redirects/test-db.ts',
    'src/database/migrations/035_bounded_404_log.js':'src/lib/server/redirects/migrations/035_bounded_404_log.ts',
    'src/database/repositories/redirect.js':'src/lib/server/redirects/repository.ts',
    'src/plugins/context.js':'src/lib/server/redirects/access.ts',
    'src/plugins/types.js':'src/lib/server/redirects/plugin-types.ts',
    'src/redirects/loops.js':'src/lib/server/redirects/loops.ts'
   };
   const relative=path.relative(frozen,target);const native=aliases[relative];
   if(native)return path.join(root,native);
  }
 }],
 test:{environment:'node',fileParallelism:false,include:[
  'parity/emdash/redirect-integration-source/upstream/packages/core/tests/unit/database/migrations/035_bounded_404_log.test.ts',
  'parity/emdash/redirect-integration-source/upstream/packages/core/tests/integration/plugins/redirect-access-dialect.test.ts',
  'parity/emdash/redirect-integration-source/upstream/packages/core/tests/unit/plugins/redirect-types.test.ts'
 ]}
});
