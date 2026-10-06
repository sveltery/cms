// Exact finite provider19 transport reversal; zero product execution credit.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const root=new URL('../',import.meta.url);
const ledger=JSON.parse(readFileSync(new URL('parity/emdash/entry-locks/canonical-registration-transport.json',root),'utf8'));
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
export function readEntryLockPriorNative(path){
 const actual=readFileSync(new URL(path,root));
 const leaf=ledger.changedLeaves.find(row=>row.path===path);
 if(!leaf)return actual.toString();
 assert.equal(actual.length,leaf.afterBytes,path+' complete current bytes');
 assert.equal(digest(actual),leaf.afterSha256,path+' complete current SHA');
 let body=actual.toString();
 for(const edit of leaf.edits.toReversed()){
  assert.equal(body.split(edit.after).length-1,edit.count,path+' exact reverse span');
  body=body.replaceAll(edit.after,edit.before);
 }
 const prior=Buffer.from(body);
 assert.equal(prior.length,leaf.baseBytes,path+' complete qualified18 bytes');
 assert.equal(digest(prior),leaf.baseSha256,path+' complete qualified18 SHA');
 assert.deepEqual(prior,readFileSync(new URL(leaf.archive,root)),path+' whole qualified18 archive');
 return body;
}
export function checkEntryLockCanonicalTransport(){
 for(const leaf of ledger.changedLeaves)readEntryLockPriorNative(leaf.path);
 return {wholeNativeLeaves:ledger.changedLeaves.length,finiteSpans:ledger.changedLeaves.reduce((n,row)=>n+row.edits.length,0),productCallbacks:0};
}
