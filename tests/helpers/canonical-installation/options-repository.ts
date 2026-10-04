import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

// Node's default strip-only mode rejects the preserved Source parameter property.
// Execute the complete actual product module with Node's native TS transform;
// the Vite application already transforms the same syntax in normal builds.
const path = new URL('../../../src/lib/server/options/repository.ts', import.meta.url);
const source = readFileSync(path, 'utf8').replace(/from (['"])([^'"]+)\1/g,
  (_whole, _quote, reference) => 'from ' + JSON.stringify(reference.startsWith('.')
    ? new URL(reference, path).href : import.meta.resolve(reference)));
export const { OptionsRepository } = await import('data:text/javascript;base64,' +
  Buffer.from(stripTypeScriptTypes(source, { mode:'transform' })).toString('base64')) as
  typeof import('../../../src/lib/server/options/repository.ts');
