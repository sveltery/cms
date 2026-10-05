import {defineConfig} from 'vitest/config';
import {dirname,resolve,relative} from 'node:path';
const root=import.meta.dirname;
const frozen=resolve(root,'parity/emdash/byline-lifecycle-source/upstream/packages/core');
const imports:Record<string,string>={
 'src/api/index.ts':'tests/helpers/byline-lifecycle/source-host.mjs',
 'src/api/handlers/content.ts':'tests/helpers/byline-lifecycle/source-host.mjs',
 'tests/utils/test-db.ts':'tests/helpers/byline-lifecycle/source-host.mjs',
 'src/schema/registry.ts':'tests/helpers/byline-lifecycle/source-host.mjs',
 'src/i18n/config.ts':'src/lib/server/menus/i18n-config.ts',
 'src/database/repositories/byline.ts':'src/lib/server/bylines/repository.ts',
 'src/database/repositories/content.ts':'src/lib/server/database/lifecycle/upstream/database/repositories/content.ts',
 'src/database/repositories/revision.ts':'src/lib/server/database/lifecycle/upstream/database/repositories/revision.ts',
 'src/database/repositories/user.ts':'parity/emdash/byline-source/upstream/packages/core/src/database/repositories/user.ts'
};
export default defineConfig({plugins:[{name:'whole-immutable-byline-lifecycle-native-host',enforce:'pre',resolveId(id,importer){
 if(!importer?.startsWith(frozen)||!id.startsWith('.'))return;
 const key=relative(frozen,resolve(dirname(importer),id.replace(/\.js$/,'.ts'))).replaceAll('\\','/');
 return key in imports?resolve(root,imports[key]):undefined;
}}],test:{environment:'node',fileParallelism:false,include:[
 'parity/emdash/byline-lifecycle-source/upstream/packages/core/tests/unit/api/content-handlers.test.ts',
 'parity/emdash/byline-lifecycle-source/upstream/packages/core/tests/integration/content/content-list-byline-filter.test.ts',
 'parity/emdash/byline-lifecycle-source/upstream/packages/core/tests/integration/content/permanent-delete-bylines.test.ts'
]}});
