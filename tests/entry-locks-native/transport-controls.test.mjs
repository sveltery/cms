// Native guard controls execute real whole-file reversals, not product callbacks.
import {test} from 'vitest';
import assert from 'node:assert/strict';
import {cpSync,mkdirSync,mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
const root=resolve(import.meta.dirname,'../..');
test('whole current reversals pass and changed old body, unowned repository and pin edits are rejected',()=>{
 const directory=mkdtempSync(resolve(tmpdir(),'entry-lock-whole-reversal-controls-'));
 try{
  const canonical=JSON.parse(readFileSync(resolve(root,'parity/emdash/entry-locks/canonical-registration-transport.json'),'utf8'));
  const editor=JSON.parse(readFileSync(resolve(root,'parity/emdash/entry-locks/editor-transport.json'),'utf8'));
  const writer=JSON.parse(readFileSync(resolve(root,'parity/emdash/entry-locks/writer-transport.json'),'utf8'));
  const paths=new Set(['parity/emdash/entry-locks','src/lib/server/entry-locks','src/lib/entry-locks',
   'src/app.d.ts','scripts/check-entry-locks-source.mjs','scripts/entry-locks-canonical-transport.mjs',
   ...canonical.changedLeaves.map(row=>row.path),...editor.sharedDrafts.map(row=>row.path),...writer.sharedDrafts.map(row=>row.path)]);
  for(const path of paths){const output=resolve(directory,path);mkdirSync(dirname(output),{recursive:true});cpSync(resolve(root,path),output,{recursive:true});}
  const run=()=>spawnSync(process.execPath,['scripts/check-entry-locks-source.mjs'],{cwd:directory,encoding:'utf8'});
  const positive=run();assert.equal(positive.status,0,positive.stdout+positive.stderr);
  const controls=[
   {path:'tests/blocks/provider-preservation.test.ts',before:'assert.equal(writes,0)',after:'assert.equal(writes,1)',diagnostic:/complete current SHA/},
   {path:'src/lib/server/entry-locks/repository.ts',before:'const CLAIM_ATTEMPTS = 2;',after:'const CLAIM_ATTEMPTS = 1;',diagnostic:/complete repository reversal/},
   {path:'parity/emdash/entry-locks/inventory.json',before:'913cb1bb9b7f08c3ff0d258b4420e53835b6a58e',after:'0000000000000000000000000000000000000000',diagnostic:/913cb1bb9b7f08c3ff0d258b4420e53835b6a58e/}
  ];
  for(const control of controls){
   const path=resolve(directory,control.path),original=readFileSync(path,'utf8');
   assert.ok(original.includes(control.before),control.path+' actual original control');
   writeFileSync(path,original.replace(control.before,control.after));
   const refusal=run();assert.equal(refusal.status,1,control.path+' actual rejection');assert.match(refusal.stderr,control.diagnostic);
   writeFileSync(path,original);assert.equal(run().status,0,control.path+' whole restoration');
  }
 }finally{rmSync(directory,{recursive:true,force:true});}
});
