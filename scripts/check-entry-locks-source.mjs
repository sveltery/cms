import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url);
const inventory=JSON.parse(readFileSync(new URL('parity/emdash/entry-locks/inventory.json',root),'utf8'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
assert.equal(inventory.pin,'913cb1bb9b7f08c3ff0d258b4420e53835b6a58e');
for(const row of inventory.source){
 const bytes=readFileSync(new URL('parity/emdash/entry-locks/source/'+row.path,root));
 assert.equal(bytes.length,row.bytes,row.path+' whole bytes');
 assert.equal(hash(bytes),row.sha256,row.path+' whole SHA256');
 assert.equal(createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex'),row.gitBlob,row.path+' Git blob');
}
assert.deepEqual(inventory.unresolvedRelativeImports,[]);
const ledger=JSON.parse(readFileSync(new URL('parity/emdash/entry-locks/repository-transport.json',root),'utf8'));
const source=readFileSync(new URL(ledger.source,root),'utf8');
let native=readFileSync(new URL(ledger.native,root),'utf8');
assert.ok(native.startsWith(ledger.header));native=native.slice(ledger.header.length);
for(const [original,mapped] of Object.entries(ledger.namespace))native=native.replaceAll(mapped,original);
for(const span of ledger.finiteSpans.slice().reverse()){
 const positions=native.split(span.native);assert.equal(positions.length,2,span.name+' exact unique transport span');
 native=positions.join(span.original);
}
assert.equal(native,source,'complete repository reversal');
assert.equal(hash(Buffer.from(source)),ledger.sourceSha256);
console.log(JSON.stringify({pin:inventory.pin,wholeSourceFiles:inventory.source.length,wholeSourceBytes:inventory.source.reduce((n,row)=>n+row.bytes,0),families:inventory.families.length,repositoryFiniteSpans:ledger.finiteSpans.length,wholeRepositoryReversed:true,productTestsRun:0}));
