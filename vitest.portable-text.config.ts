import {defineConfig} from 'vitest/config';
import {resolve,dirname} from 'node:path';
const root=import.meta.dirname;
const frozen=resolve(root,'parity/emdash/portable-text/source');
export default defineConfig({
  plugins:[{name:'immutable-portable-text-pure-host',enforce:'pre',resolveId(specifier,importer){
    if(!importer?.startsWith(frozen)||!specifier.startsWith('.'))return;
    const target=resolve(dirname(importer),specifier).replace(/\.(tsx?|js)$/,'');
    if(target.endsWith('/src/components/PortableTextEditor'))return resolve(root,'tests/helpers/portable-text-pure-bridge.ts');
    if(target.endsWith('/src/portable-text-table'))return resolve(root,'src/lib/portable-text/portable-text-table.ts');
    if(target.endsWith('/src/client/portable-text'))return resolve(root,'src/lib/portable-text/markdown.ts');
    if(target.endsWith('/src/fields/portable-text'))return resolve(root,'src/lib/portable-text/field.ts');
  }}],
  test:{include:[
    'parity/emdash/portable-text/source/packages/admin/tests/editor/PortableTextEditor.code-block.test.ts',
    'parity/emdash/portable-text/source/packages/admin/tests/components/PortableTextEditor.{list,table}.test.ts',
    'parity/emdash/portable-text/source/packages/admin/tests/lib/portable-text-table.test.ts',
    'parity/emdash/portable-text/source/packages/core/tests/fields/portable-text.test.ts',
    'parity/emdash/portable-text/source/packages/core/tests/unit/client/portable-text.test.ts'
  ],environment:'node'}
});
