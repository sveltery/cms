import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

// Execute the complete actual product module using the same native transform
// needed by its preserved Source constructor; no callback/body projection.
const path = new URL('../../../src/lib/server/taxonomies/repository.ts', import.meta.url);
let source = readFileSync(path, 'utf8').replace(/from (['"])([^'"]+)\1/g,
  (_whole, _quote, reference) => 'from ' + JSON.stringify(reference.startsWith('.')
    ? new URL(reference,path).href : import.meta.resolve(reference)));
source = source.replace(/import\((['"])([^'"]+)\1\)/g,
  (_whole, _quote, reference) => 'import(' + JSON.stringify(reference.startsWith('.')
    ? new URL(reference,path).href : import.meta.resolve(reference)) + ')');
export const { TaxonomyRepository } = await import('data:text/javascript;base64,' +
  Buffer.from(stripTypeScriptTypes(source,{mode:'transform'})).toString('base64')) as
  typeof import('../../../src/lib/server/taxonomies/repository.ts');
