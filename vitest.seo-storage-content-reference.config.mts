import { defineConfig } from 'vitest/config';
import { dirname, resolve, relative } from 'node:path';
import { existsSync } from 'node:fs';
import reference from './vitest.seo-storage-reference.config.mts';
import { generateObjectCacheModule, generateWaitUntilModule } from './parity/emdash/taxonomies/source/packages/core/src/astro/integration/virtual-modules.ts';
const root=import.meta.dirname;
const seo=resolve(root,'parity/emdash/seo-storage/source');
const taxonomy=resolve(root,'parity/emdash/taxonomies/source');
const modules=new Map([
 ['virtual:emdash/object-cache',generateObjectCacheModule()],
 ['virtual:emdash/wait-until',generateWaitUntilModule(undefined)]
]);
const shared:Record<string,string>={
 'packages/core/src/database/repositories/seo.ts':'tests/helpers/seo/reference-api.mjs',
 'packages/core/src/request-context.ts':'src/lib/server/menus/context.ts',
 'packages/core/src/request-cache.ts':'src/lib/server/menus/request-cache.ts',
 'packages/core/src/object-cache/index.ts':'src/lib/server/menus/object-cache.ts',
 'packages/core/src/i18n/config.ts':'src/lib/server/menus/i18n-config.ts',
 'packages/core/src/i18n/resolve.ts':'src/lib/server/menus/i18n-resolve.ts',
 'packages/core/src/seo/index.ts':'src/lib/seo/meta.ts',
 'packages/core/src/database/repositories/taxonomy.ts':'src/lib/server/taxonomies/repository.ts',
 'packages/core/src/database/repositories/taxonomy-def.ts':'src/lib/server/taxonomies/definitions.ts',
 'packages/core/src/taxonomies/index.ts':'src/lib/server/taxonomies/index.ts',
 'packages/core/src/schema/collection-slugs-cache.ts':'src/lib/server/schema/collection-slugs-cache.ts'
};
export default defineConfig({plugins:[{name:'seo-whole-content-genuine-source-reference',enforce:'pre',resolveId(id,importer){
 if(modules.has(id))return '\0'+id;
 if((importer?.startsWith(seo)||importer?.startsWith(taxonomy))&&id.startsWith('.')){
  const base=importer.startsWith(seo)?seo:taxonomy;
  const logical=relative(base,resolve(dirname(importer),id.replace(/\.js$/,'.ts'))).replaceAll('\\','/');
  if(logical in shared)return resolve(root,shared[logical]);
  const retained=resolve(seo,logical),original=resolve(taxonomy,logical);
  if(existsSync(retained))return retained;
  if(existsSync(original))return original;
 }
},load(id){if(id.startsWith('\0'))return modules.get(id.slice(1));}},...(reference.plugins??[])],test:{environment:'node',fileParallelism:false,include:[
 'parity/emdash/seo-storage/source/packages/core/tests/integration/seo/seo.test.ts'
]}});
