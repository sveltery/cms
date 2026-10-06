import { test } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync,mkdirSync,writeFileSync,mkdtempSync,rmSync } from 'node:fs';
import {createHash} from 'node:crypto';
import { execFileSync,spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { resolve,dirname } from 'node:path';
const root=resolve(import.meta.dirname,'../..');
const receipt=JSON.parse(readFileSync(resolve(root,'parity/emdash/entry-locks/evidence/finite-whitespace-authority.json'),'utf8'));
const union=JSON.parse(readFileSync(resolve(root,'parity/emdash/entry-locks/evidence/media-c4-development-union.json'),'utf8')).conflicts.find(row=>row.path==='.gitattributes');
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
test('only the exact immutable Source authorities receive whitespace exemptions',()=>{
 const current=readFileSync(resolve(root,'.gitattributes'));
 assert.equal(digest(current.subarray(0,union.incomingBytes)),union.incomingSha256);
 assert.equal(current.subarray(union.incomingBytes).toString(),receipt.append);
 const directory=mkdtempSync(resolve(tmpdir(),'entry-lock-whitespace-controls-'));
 try{
  execFileSync('git',['init','--quiet'],{cwd:directory});
  writeFileSync(resolve(directory,'.gitattributes'),current);
  const controls=[...receipt.paths.map(row=>({path:row.path,allowed:true})),
   {path:'src/lib/server/entry-locks/repository.ts',allowed:false},
   {path:'tests/entry-locks-native/product.ts',allowed:false},
   {path:'parity/emdash/entry-locks/source/packages/core/src/database/migrations/001_initial.ts',allowed:false},
   {path:'parity/emdash/entry-locks/evidence/unowned.log',allowed:false}];
  for(const control of controls){mkdirSync(dirname(resolve(directory,control.path)),{recursive:true});writeFileSync(resolve(directory,control.path),'meaningful statement;   \n');execFileSync('git',['add',control.path],{cwd:directory});
   const result=spawnSync('git',['diff','--cached','--check','--',control.path],{cwd:directory,encoding:'utf8'});
   assert.equal(result.status,control.allowed?0:2,control.path+' actual Git diagnostic result');
   if(!control.allowed)assert.match(result.stdout,/trailing whitespace/);
  }
 }finally{rmSync(directory,{recursive:true,force:true});}
 for(const row of receipt.paths)assert.equal(digest(readFileSync(resolve(root,row.path))),row.sha256);
});
