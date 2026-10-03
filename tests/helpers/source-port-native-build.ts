import {spawn} from 'node:child_process';
import {access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

// The complete welcome callback host uses actual built Kit HTTP routes. Build
// the missing native fixture before workers/test clocks on clean CI. No callback is skipped
// and the mandatory later production-build/bootstrap phase stays unchanged.
export default async function setup(){
 try{await access(new URL('../../.svelte-kit/output/server/manifest.js',import.meta.url));return;}
 catch(cause){if(!(cause instanceof Error&&'code' in cause&&cause.code==='ENOENT'))throw cause;}
 console.log('[source-host] build actual native HTTP fixture before immutable callbacks');
 await new Promise<void>((resolve,reject)=>{
  const child=spawn('pnpm',['build'],{cwd:fileURLToPath(new URL('../../',import.meta.url)),env:process.env,stdio:'inherit'});
  child.once('error',reject);
  child.once('exit',(code,signal)=>code===0?resolve():reject(new Error(`Native source-host build failed: ${code??signal}`)));
 });
}
