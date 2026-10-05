import {defineConfig} from 'vitest/config';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('.',import.meta.url));
const frozen=path.join(root,'parity/emdash/full-seed-engine/source/packages/core');
const modules:Record<string,string>={
 '../cloudflare/src/db/d1-dialect.js':'tests/helpers/full-seed/source-workerd-dialect.ts',
 'src/database/migrations/runner.js':'tests/helpers/full-seed/source-workerd-migrations.ts',
 'src/seed/apply.js':'tests/helpers/full-seed/source-apply-d1.ts',
 'src/seed/types.js':'src/lib/server/seed/types.ts',
 'src/database/types.js':'src/lib/server/seed/upstream/database/types.ts',
 'src/database/repositories/options.js':'src/lib/server/comments/upstream/database/repositories/options.ts',
 'src/database/repositories/content.js':'src/lib/server/seed/d1-content.ts',
 'src/schema/block-type-registry.js':'src/lib/server/blocks/upstream/schema/block-type-registry.ts'
};
export default defineConfig({plugins:[{name:'whole-original-seed-workerd-d1-family-host',enforce:'pre',resolveId(id,importer){
 if(!importer?.startsWith(frozen))return;
 if(id==='cloudflare:test')return path.join(root,'tests/helpers/blocks/source-d1-env.ts');
 if(id==='kysely')return path.join(root,'tests/helpers/full-seed/source-workerd-kysely.ts');
 if(!id.startsWith('.'))return;
 const relative=path.relative(frozen,path.resolve(path.dirname(importer),id)).replaceAll(path.sep,'/');
 return modules[relative]&&path.join(root,modules[relative]);
 }}],test:{environment:'node',fileParallelism:false,testTimeout:30000,hookTimeout:30000,include:[
 'parity/emdash/full-seed-engine/source/packages/core/tests/workerd/seed-settings-d1.test.ts',
 'parity/emdash/full-seed-engine/source/packages/core/tests/workerd/seed-trash-d1.test.ts',
 'parity/emdash/full-seed-engine/source/packages/core/tests/workerd/blocks-seed-d1.test.ts'
 ]}});
