// Immutable reference-support provenance only, not runtime acceptance.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
const root=resolve(import.meta.dirname,'..');
const inventory=JSON.parse(readFileSync(resolve(root,'docs/taxonomy-reference-source.json'),'utf8'));
assert.equal(inventory.sourcePin,'913cb1bb9b7f08c3ff0d258b4420e53835b6a58e');
assert.equal(inventory.files.length,214);
assert.equal(inventory.runtimeEdges.length,538);
assert.equal(inventory.wholeCoreFamilies.length,22);
for(const file of inventory.files){
 const bytes=readFileSync(resolve(root,'parity/emdash/taxonomies/source',file.path));
 assert.equal(bytes.length,file.bytes,file.path);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256,file.path);
 assert.equal(createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'),file.gitBlob,file.path);
}
console.log(JSON.stringify({wholeReferenceFiles:214,additionalWholeFiles:61,wholeCoreFamilies:22,sourceCallbacksExecuted:0,productTestsRun:0}));
