import {defineConfig} from 'vitest/config';
import {resolve,dirname} from 'node:path';
const root=import.meta.dirname,frozen=resolve(root,'parity/emdash/editor-taxonomies/source/packages/admin');
export default defineConfig({plugins:[{name:'native-taxonomy-matcher-source-host',enforce:'pre',resolveId(specifier,importer){
 if(importer?.startsWith(frozen)&&specifier.startsWith('.')&&resolve(dirname(importer),specifier).replace(/\.(ts|js)$/,'')===resolve(frozen,'src/lib/taxonomy-match'))return resolve(root,'src/lib/taxonomy-editor/source/taxonomy-match.ts');
}}],test:{include:['parity/emdash/editor-taxonomies/source/packages/admin/tests/lib/taxonomy-match.test.ts'],environment:'node'}});
