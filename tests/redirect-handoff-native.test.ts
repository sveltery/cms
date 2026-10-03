// Original utility control-flow comparison; no real host or Source callback credit.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

test('native deferred task host handoff cannot synchronously reject its caller',()=>{
 const module=fileURLToPath(new URL('../src/lib/server/redirects/after.ts',import.meta.url));
 const script=`import {after} from ${JSON.stringify(module)};
  const result={returned:false,synchronousError:null,taskRan:false,handoffRejection:null};
  process.on('unhandledRejection',cause=>{result.handoffRejection=cause.message;});
  try{after(()=>{result.taskRan=true;},()=>{throw new Error('ordinary synthetic handoff');});result.returned=true;}
  catch(cause){result.synchronousError=cause.message;}
  setTimeout(()=>process.stdout.write(JSON.stringify(result)),20);`;
 const actual=JSON.parse(execFileSync(process.execPath,['--experimental-strip-types','--input-type=module','-e',script],{encoding:'utf8'}));
 assert.deepEqual(actual,{returned:true,synchronousError:null,taskRan:true,handoffRejection:'ordinary synthetic handoff'});
});
