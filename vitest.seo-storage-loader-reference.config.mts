import {defineConfig} from 'vitest/config';
import {dirname,resolve,relative} from 'node:path';
import content from './vitest.seo-storage-content-reference.config.mts';
const root=import.meta.dirname;
const seo=resolve(root,'parity/emdash/seo-storage/source');
const taxonomy=resolve(root,'parity/emdash/taxonomies/source');
export default defineConfig({plugins:[{name:'seo-whole-loader-genuine-source-reference',enforce:'pre',resolveId(id,importer){
 if((importer?.startsWith(seo)||importer?.startsWith(taxonomy))&&id.startsWith('.')){
  const base=importer.startsWith(seo)?seo:taxonomy;
  const logical=relative(base,resolve(dirname(importer),id.replace(/\.js$/,'.ts'))).replaceAll('\\','/');
  if(logical==='packages/core/src/api/index.ts')return resolve(root,'tests/helpers/seo/reference-content-api.mjs');
  if(logical==='packages/core/src/page/seo-panel.ts')return resolve(root,'src/lib/server/seo/panel.ts');
 }
}},...(content.plugins??[])],test:{environment:'node',fileParallelism:false,include:[
 'parity/emdash/seo-storage/source/packages/core/tests/unit/loader-seo.test.ts'
]}});
