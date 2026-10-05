import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
const root=resolve(import.meta.dirname,'..');
const inventory=JSON.parse(readFileSync(resolve(root,'docs/taxonomy-fixture-source.json'),'utf8'));
if(inventory.sourcePin!=='913cb1bb9b7f08c3ff0d258b4420e53835b6a58e') throw new Error('Unqualified Source pin');
for(const file of inventory.files) {
 const bytes=readFileSync(resolve(root,'parity/emdash/taxonomies/source',file.path));
 if(bytes.length!==file.bytes || createHash('sha256').update(bytes).digest('hex')!==file.sha256) throw new Error('Immutable Source fixture changed: '+file.path);
}
console.log('Whole immutable taxonomy Source fixture runner closure: '+inventory.files.length+' files; no execution or provider parity credit');
