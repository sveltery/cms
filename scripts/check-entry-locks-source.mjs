import {checkEntryLockCanonicalTransport} from './entry-locks-canonical-transport.mjs';
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
const runtime=JSON.parse(readFileSync(new URL('parity/emdash/entry-locks/runtime-transport.json',root),'utf8'));
assert.equal(runtime.pin,inventory.pin);
for(const row of runtime.wholeReversal){
 const original=readFileSync(new URL(row.source,root),'utf8');
 assert.equal(hash(Buffer.from(original)),row.sourceSha256);
 let target=readFileSync(new URL(row.native,root),'utf8');
 assert.ok(target.startsWith(row.header));target=target.slice(row.header.length);
 for(const [from,to] of Object.entries(row.namespace))target=target.replaceAll(to,from);
 for(const span of row.finiteSpans.slice().reverse()){
  const parts=target.split(span.native);assert.equal(parts.length,1+(span.occurrences??1),span.name);
  target=parts.join(span.original);
 }
 const expected=row.slice?original.slice(row.slice.start,row.slice.end):original;
 assert.equal(target,expected,row.native+' full reversal');
 if(row.slice)assert.equal(hash(Buffer.from(expected)),row.slice.sha256);
}
console.log(JSON.stringify({pin:inventory.pin,wholeSourceFiles:inventory.source.length,wholeSourceBytes:inventory.source.reduce((n,row)=>n+row.bytes,0),families:inventory.families.length,repositoryFiniteSpans:ledger.finiteSpans.length,wholeRepositoryReversed:true,productTestsRun:0}));

console.log(JSON.stringify(checkEntryLockCanonicalTransport()));

const editor=JSON.parse(readFileSync(new URL('parity/emdash/entry-locks/editor-transport.json',root),'utf8'));
for(const leaf of editor.sharedDrafts){
 let value=readFileSync(new URL(leaf.path,root),'utf8');
 for(const span of leaf.finiteSpans.toReversed()){
  assert.equal(value.split(span.native).length,2,leaf.path+' exact editor span');
  value=value.replace(span.native,span.original);
 }
 const bytes=Buffer.from(value);
 assert.equal(bytes.length,leaf.oldBytes,leaf.path+' complete old editor bytes');
 assert.equal(hash(bytes),leaf.oldSha256,leaf.path+' complete old editor SHA');
 assert.deepEqual(bytes,readFileSync(new URL(leaf.archive,root)),leaf.path+' whole old editor archive');
}
console.log(JSON.stringify({wholeEditorSharedReversals:editor.sharedDrafts.length,productCallbacks:0}));

const envelope=JSON.parse(readFileSync(new URL('parity/emdash/entry-locks/error-envelope-transport.json',root),'utf8'));
const errorBody=readFileSync(new URL(envelope.path,root),'utf8');
assert.equal(errorBody.split(envelope.after).length,2,'sole App.Error type-only span');
const errorPrior=Buffer.from(errorBody.replace(envelope.after,envelope.before));
assert.equal(errorPrior.length,envelope.oldBytes);assert.equal(hash(errorPrior),envelope.oldSha256);
assert.deepEqual(errorPrior,readFileSync(new URL(envelope.archive,root)),'whole old App.Error declaration');

const writer=JSON.parse(readFileSync(new URL('parity/emdash/entry-locks/writer-transport.json',root),'utf8'));
for(const leaf of writer.sharedDrafts){
 let value=readFileSync(new URL(leaf.path,root),'utf8');
 for(const span of leaf.finiteSpans.toReversed()){
  assert.equal(value.split(span.native).length,1+(span.occurrences??1),leaf.path+' exact writer span');
  value=value.replaceAll(span.native,span.original);
 }
 const bytes=Buffer.from(value);
 assert.equal(bytes.length,leaf.oldBytes,leaf.path+' complete old writer bytes');
 assert.equal(hash(bytes),leaf.oldSha256,leaf.path+' complete old writer SHA');
 assert.deepEqual(bytes,readFileSync(new URL(leaf.archive,root)),leaf.path+' whole old writer archive');
}
console.log(JSON.stringify({wholeWriterSharedReversals:writer.sharedDrafts.length,productCallbacks:0}));
