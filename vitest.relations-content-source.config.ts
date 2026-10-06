import { defineConfig } from 'vitest/config';
import {resolve,relative,dirname} from 'node:path';
import relationConfig from './vitest.relations-handlers-source.config.ts';
// Whole future lifecycle families. Their unresolved current public producer
// boundaries are recorded separately; this readiness command is not a passing
// Source gate or a completed parity claim.
const root=import.meta.dirname;const frozen=resolve(root,'parity/emdash/relations-source/executable/packages/core');
export default defineConfig({...relationConfig,plugins:[{name:'whole-relations-content-canonical-producers',enforce:'pre',resolveId(id,importer){
 if(!importer?.startsWith(frozen)||!id.startsWith('.'))return;
 const key=relative(frozen,resolve(dirname(importer),id)).replaceAll('\\','/');
 if(['src/api/handlers/content.js','src/api/handlers/revision.js','tests/utils/mcp-runtime.js','tests/utils/test-db.js'].includes(key))return resolve(root,'tests/helpers/relations/content-lifecycle-host.ts');
 if(key==='src/references/staged.js')return resolve(root,'src/lib/server/relations/staged.ts');
}},...(relationConfig.plugins??[])],test:{environment:'node',fileParallelism:false,
  include:['parity/emdash/relations-source/executable/packages/core/tests/integration/content/content-references-write.test.ts',
    'parity/emdash/relations-source/executable/packages/core/tests/integration/content/reference-constraints.test.ts',
    'parity/emdash/relations-source/executable/packages/core/tests/integration/content/reference-draft-lifecycle.test.ts']}});
