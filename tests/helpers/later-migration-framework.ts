import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
// Exercise the actual framework with only its provider registration extended.
// The real proposed8 physicalDDL is aliased to contiguous6 after actual5.
// No production provider is registered, no empty provider or marker is forged.
const path=new URL('../../src/lib/server/database/migrations.ts',import.meta.url);
let source=readFileSync(path,'utf8');
// Keep this isolated physical-provider fixture after actual5 as additive
// production providers arrive, and avoid colliding with their import names.
const registration=/^  lifecycleMigration(?:\s*,\s*[A-Za-z][A-Za-z0-9_]*)*\s*\n\];/m;
assert.match(source,registration);
source=source.replace(registration,'  lifecycleMigration,\n  laterFixtureMigration\n];')
  .replace(/from (['"])([^'"]+)\1/g,(_whole,_quote,reference)=>'from '+JSON.stringify(reference.startsWith('.') ? new URL(reference,path).href : import.meta.resolve(reference)));
source='import {metadataFidelityMigration as laterFixtureMigration} from '+JSON.stringify(new URL('../fixtures/later-metadata-provider.ts',import.meta.url).href)+';\n'+source;
export const {migrateCms}=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(source,{mode:'transform'})).toString('base64')) as typeof import('../../src/lib/server/database/migrations.ts');
