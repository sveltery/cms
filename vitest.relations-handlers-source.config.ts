import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('.',import.meta.url));
const frozen=path.join(root,'parity/emdash/relations-source/executable/packages/core');
export default defineConfig({
  plugins:[{name:'whole-original-relation-API-boundaries',enforce:'pre',resolveId(id,importer){
    if(!importer?.startsWith(frozen))return;
    if(id==='@emdash-cms/auth')return path.join(root,'tests/helpers/relations/source-auth.ts');
    if(!id.startsWith('.'))return;
    const relative=path.relative(frozen,path.resolve(path.dirname(importer),id)).replaceAll(path.sep,'/');
    const map:Record<string,string>={
      'src/api/handlers/relations.js':'src/lib/server/relations/handlers.ts',
      'src/database/repositories/relation.js':'src/lib/server/relations/repository.ts',
      'src/database/repositories/content.js':'src/lib/server/database/lifecycle/upstream/database/repositories/content.ts',
      'src/database/repositories/revision.js':'src/lib/server/database/lifecycle/upstream/database/repositories/revision.ts',
      'src/schema/registry.js':'tests/helpers/relations/native-db.ts',
      'tests/utils/test-db.js':'tests/helpers/relations/native-db.ts',
      'src/api/handlers/schema.js':'tests/helpers/relations/schema-delete.ts',
      'src/astro/routes/api/relations/index.js':'tests/helpers/relations/routes.ts',
      'src/astro/routes/api/relations/[id]/index.js':'tests/helpers/relations/routes.ts',
      'src/astro/routes/api/content/[collection]/[id]/references/[relation]/children.js':'tests/helpers/relations/reference-routes.ts',
      'src/i18n/config.js':'src/lib/server/menus/i18n-config.ts'
    };return map[relative]&&path.join(root,map[relative]);
  }}],
  test:{environment:'node',fileParallelism:false,include:['parity/emdash/relations-source/executable/packages/core/tests/integration/api/relations-handlers.test.ts','parity/emdash/relations-source/executable/packages/core/tests/integration/api/references-edges.test.ts']}
});
