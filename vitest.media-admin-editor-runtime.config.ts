import {defineConfig} from 'vitest/config';
import {resolve,dirname} from 'node:path';
const root=import.meta.dirname,source=resolve(root,'parity/emdash/media-admin-editor/runtime-source/packages/core');
export default defineConfig({plugins:[{name:'whole-media-runtime-source-fixture',enforce:'pre',resolveId(id,importer){
 if(id==='#node-sqlite')return resolve(root,'src/lib/server/database/node-sqlite-compat.ts');
 if(id==='@emdash-cms/auth')return resolve(root,'src/lib/server/auth/roles.ts');
 if(importer?.startsWith(source)&&id==='kysely')return resolve(root,'tests/helpers/media-admin-editor-runtime-db.ts');
 if(!importer?.startsWith(source)||!id.startsWith('.'))return;
 const relative=resolve(dirname(importer),id).slice(source.length+1).replace(/\.js$/,'.ts');
 const modules:Record<string,string>={
  'src/api/handlers/media-usage.ts':'src/lib/server/general-media/upstream/api/handlers/media-usage-read.ts',
  'src/api/schemas/index.ts':'src/lib/server/general-media/upstream/api/schemas/media-usage.ts',
  'src/astro/integration/routes.ts':'tests/helpers/media-admin-editor-runtime-routes.ts',
  'src/astro/routes/api/media/[id]/usage.ts':'tests/helpers/media-admin-editor-runtime-usage-route.ts',
  'src/database/migrations/runner.ts':'tests/helpers/media-admin-editor-runtime-db.ts',
  'src/database/repositories/media-usage.ts':'src/lib/server/general-media/upstream/database/repositories/media-usage.ts',
  'src/database/repositories/media.ts':'src/lib/server/general-media/upstream/database/repositories/media.ts',
  'src/database/types.ts':'src/lib/server/general-media/upstream/database/types.ts',
  'src/media/usage/content-refresh.ts':'src/lib/server/blocks/upstream/media/usage/schema-invalidation.ts',
  'src/media/usage/content-snapshots.ts':'src/lib/server/blocks/upstream/media/usage/types.ts',
  'src/media/usage/source-key.ts':'src/lib/server/general-media/upstream/media/usage/source-key.ts',
 };
 if(modules[relative])return resolve(root,modules[relative]);
}}],test:{environment:'node',fileParallelism:false,include:['parity/emdash/media-admin-editor/runtime-source/packages/core/tests/unit/api/media-usage-read-route.test.ts']}});
