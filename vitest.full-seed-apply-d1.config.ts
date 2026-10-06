import {defineConfig,mergeConfig} from 'vitest/config';
import original from './vitest.full-seed-apply.config.ts';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('.',import.meta.url));
const frozen=path.join(root,'parity/emdash/source-seed-backend/source/packages/core');
const modules:Record<string,string>={
 'src/seed/apply.js':'tests/helpers/full-seed/source-apply-d1.ts',
 'src/database/repositories/content.js':'src/lib/server/seed/d1-content.ts'
};
const config=mergeConfig(original,defineConfig({define:{__SEED_TEST_STORAGE__:JSON.stringify('raw-d1')}}));
config.plugins?.unshift({name:'original-apply-d1-production-specialization',enforce:'pre',resolveId(id,importer){
 if(!importer?.startsWith(frozen)||!id.startsWith('.'))return;
 const relative=path.relative(frozen,path.resolve(path.dirname(importer),id)).replaceAll(path.sep,'/');
 return modules[relative]&&path.join(root,modules[relative]);
}});
export default config;
