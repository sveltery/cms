import { defineConfig } from 'vitest/config';
import { dirname, resolve, relative } from 'node:path';
import { existsSync } from 'node:fs';
import { generateConfigModule, generateDialectModule } from './parity/emdash/taxonomies/source/packages/core/src/astro/integration/virtual-modules.ts';
import { sqlite } from './parity/emdash/taxonomies/source/packages/core/src/db/adapters.ts';

const root=import.meta.dirname;
const frozen=resolve(root,'parity/emdash/taxonomies/source');
// Genuine original descriptor and generators, with the actual Source Node factory.
const descriptor=sqlite({url:':memory:'});
const virtualModules=new Map([
 ['virtual:emdash/config',generateConfigModule({databaseConfig:descriptor.config})],
 ['virtual:emdash/dialect',generateDialectModule({entrypoint:descriptor.entrypoint,type:descriptor.type,
  supportsRequestScope:descriptor.supportsRequestScope??false,
  supportsCoalescing:descriptor.supportsCoalescing??false,
  supportsCollectionDeletionGuard:descriptor.supportsCollectionDeletionGuard??false})]
]);
const nativeBoundaries={
  "packages/core/src/taxonomies/index.ts": "src/lib/server/taxonomies/index.ts",
  "packages/core/src/taxonomies/term-counts.ts": "src/lib/server/taxonomies/term-counts.ts",
  "packages/core/src/database/repositories/taxonomy.ts": "src/lib/server/taxonomies/repository.ts",
  "packages/core/src/database/repositories/taxonomy-def.ts": "src/lib/server/taxonomies/definitions.ts",
  "packages/core/src/schema/collection-slugs-cache.ts": "src/lib/server/schema/collection-slugs-cache.ts",
  "packages/core/src/request-context.ts": "src/lib/server/menus/context.ts",
  "packages/core/src/request-cache.ts": "src/lib/server/menus/request-cache.ts",
  "packages/core/src/object-cache/index.ts": "src/lib/server/menus/object-cache.ts",
  "packages/core/src/i18n/config.ts": "src/lib/server/menus/i18n-config.ts",
  "packages/core/src/i18n/resolve.ts": "src/lib/server/menus/i18n-resolve.ts",
  "packages/core/src/loader.ts": "src/lib/server/taxonomies/loader.ts",
  "packages/core/src/database/repositories/types.ts": "src/lib/server/database/lifecycle/upstream/database/repositories/types.ts",
  "packages/core/src/astro/prefetch.ts": "src/lib/server/menus/prefetch.ts",
  "packages/core/src/api/handlers/taxonomies.ts": "src/lib/server/taxonomies/handlers.ts",
  "packages/core/src/api/handlers/bulk-tag.ts": "tests/helpers/taxonomies/source-bulk-reference.mjs",
  "packages/core/src/api/handlers/content.ts": "tests/helpers/taxonomies/source-content-reference.mjs"
};
const sourceAliases={
 '#node-sqlite':'packages/core/src/db/node-sqlite-compat.ts',
 '#api/schemas.js':'packages/core/src/api/schemas/index.ts',
 'emdash/db/sqlite':'packages/core/src/db/sqlite.ts'
};
const aliasPrefixes={
 '#api/':'api/','#cache/':'cache/','#db/':'database/','#taxonomies/':'taxonomies/','#utils/':'utils/','#media/':'media/'
};
function sourcePath(path) {
 const logical=relative(frozen,path).replaceAll('\\','/');
 const native=nativeBoundaries[logical];
 return native?resolve(root,native):path;
}
export default defineConfig({
 plugins:[{
  name:'whole-original-taxonomy-reference-fixture',enforce:'pre',
  resolveId(id,importer) {
   if(virtualModules.has(id))return '\0'+id;
   if(id==='@emdash-cms/auth')return resolve(root,'tests/helpers/taxonomies/auth-reference.mjs');
   if(id==='@emdash-cms/admin/slugify')return resolve(root,'src/lib/server/taxonomies/slugify.ts');
   if(id in sourceAliases)return sourcePath(resolve(frozen,sourceAliases[id]));
   for(const [prefix,directory] of Object.entries(aliasPrefixes)){
    if(id.startsWith(prefix))return sourcePath(resolve(frozen,'packages/core/src',directory,id.slice(prefix.length).replace(/\.js$/,'.ts')));
   }
   if(importer?.startsWith(frozen)&&id.startsWith('.')){
    const path=resolve(dirname(importer),id.replace(/\.js$/,'.ts'));
    if(existsSync(path)||relative(frozen,path) in nativeBoundaries)return sourcePath(path);
   }
  },
  load(id) {if(id.startsWith('\0'))return virtualModules.get(id.slice(1));}
 }],
 test:{environment:'node',fileParallelism:false,include:[
  "parity/emdash/taxonomies/source/packages/core/tests/integration/content/content-taxonomies.test.ts",
  "parity/emdash/taxonomies/source/packages/core/tests/integration/database/taxonomy-repository-pagination.test.ts",
  "parity/emdash/taxonomies/source/packages/core/tests/integration/taxonomies/bulk-tag.test.ts",
  "parity/emdash/taxonomies/source/packages/core/tests/integration/taxonomies/taxonomy-def-structure.test.ts",
  "parity/emdash/taxonomies/source/packages/core/tests/integration/taxonomies/taxonomy-locale-terms.test.ts",
  "parity/emdash/taxonomies/source/packages/core/tests/integration/taxonomies/taxonomy-translation-group-assignments.test.ts",
  "parity/emdash/taxonomies/source/packages/core/tests/integration/taxonomy-reorder-writes.test.ts",
  "parity/emdash/taxonomies/source/packages/core/tests/integration/taxonomy-term-counts-plan.test.ts",
  "parity/emdash/taxonomies/source/packages/core/tests/integration/taxonomy-term-order-plan.test.ts",
  "parity/emdash/taxonomies/source/packages/core/tests/unit/taxonomies/defs-cache.test.ts",
  "parity/emdash/taxonomies/source/packages/core/tests/unit/taxonomies/entry-terms-object-cache.test.ts",
  "parity/emdash/taxonomies/source/packages/core/tests/unit/taxonomies/get-all-terms-for-entries.test.ts",
  "parity/emdash/taxonomies/source/packages/core/tests/unit/taxonomies/get-taxonomy-terms.test.ts",
  "parity/emdash/taxonomies/source/packages/core/tests/unit/taxonomies/get-term.test.ts",
  "parity/emdash/taxonomies/source/packages/core/tests/unit/taxonomies/taxonomies.test.ts",
  "parity/emdash/taxonomies/source/packages/core/tests/unit/taxonomies/taxonomy-crud.test.ts",
  "parity/emdash/taxonomies/source/packages/core/tests/unit/taxonomies/term-count-demand.test.ts",
  "parity/emdash/taxonomies/source/packages/core/tests/unit/taxonomies/term-counts.test.ts",
  "parity/emdash/taxonomies/source/packages/core/tests/unit/taxonomies/term-list-counts.test.ts",
  "parity/emdash/taxonomies/source/packages/core/tests/unit/taxonomies/term-list-object-cache.test.ts",
  "parity/emdash/taxonomies/source/packages/core/tests/unit/taxonomies/term-reorder.test.ts",
  "parity/emdash/taxonomies/source/packages/core/tests/unit/taxonomies/term-slug-generation.test.ts"
]}
});
