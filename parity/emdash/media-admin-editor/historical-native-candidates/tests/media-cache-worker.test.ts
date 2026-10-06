// Original actual workerd module-boundary requirement; zero copied Source/D1/SQL credit.
import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'vite';
import {Miniflare} from 'miniflare';
test('actual media invalidator starts without Node compatibility and detaches the shared settings cache',async()=>{
 const bundled=await build({configFile:false,logLevel:'error',build:{target:'es2022',minify:false,write:false,lib:{entry:new URL('./helpers/media-cache-worker.ts',import.meta.url).pathname,formats:['es'],fileName:'media-cache-worker'},rollupOptions:{external:['node:async_hooks']}}});
 assert.ok(!('on' in bundled));const outputs=Array.isArray(bundled)?bundled:[bundled];const chunks=outputs.flatMap(output=>output.output).filter(output=>output.type==='chunk');assert.equal(chunks.length,1);
 const worker=new Miniflare({modules:[{type:'ESModule',path:new URL('./helpers/media-cache-worker.mjs',import.meta.url).pathname,contents:chunks[0].code}],compatibilityDate:'2026-05-07',host:'127.0.0.1',port:0});
 try{const response=await worker.dispatchFetch('https://cms.example/media-cache');assert.equal(response.status,200);assert.deepEqual(await response.json(),{revisionDelta:1,detachedA:true,detachedB:true,newAHasValue:false,newBHasValue:false});}finally{await worker.dispose();}
});
