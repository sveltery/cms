// Original real workerd/R2/Images requirements; zero copied Source callback or full Kit Worker credit.
import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'vite';
import {Miniflare} from 'miniflare';
import {imageSize} from 'image-size';
import {PNG_4x4} from '../parity/emdash/media/source-fixtures/image-fixtures.ts';

async function fixture(images:boolean){
 const bundled=await build({configFile:false,logLevel:'error',build:{target:'es2022',minify:false,write:false,lib:{entry:new URL('./helpers/media-image-worker.ts',import.meta.url).pathname,formats:['es'],fileName:'media-image-worker'}}});
 assert.ok(!('on' in bundled));const outputs=Array.isArray(bundled)?bundled:[bundled];const chunks=outputs.flatMap(output=>output.output).filter(output=>output.type==='chunk');assert.equal(chunks.length,1);
 const worker=new Miniflare({modules:[{type:'ESModule',path:new URL('./helpers/media-image-worker.mjs',import.meta.url).pathname,contents:chunks[0].code}],compatibilityDate:'2026-05-07',host:'127.0.0.1',port:0,cf:false,r2Buckets:{BUCKET:'media-image-worker'},...(images?{images:{binding:'IMAGES'}}:{})});
 const bucket=await worker.getR2Bucket('BUCKET');await bucket.put('photo.png',PNG_4x4,{httpMetadata:{contentType:'image/png'}});
 const request=(params:string)=>worker.dispatchFetch(`https://cms.example/_image?href=${encodeURIComponent('/_emdash/api/media/file/photo.png')}&${params}`);
 return {worker,bucket,request};
}
test('actual workerd Images binding emits resized raster bytes directly from real R2',async()=>{
 const app=await fixture(true);try{for(const [format,mime] of [['webp','image/webp'],['png','image/png'],['jpeg','image/jpeg'],['avif','image/avif']]){
  const response=await app.request(`w=2&f=${format}`);assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),mime);assert.equal(response.headers.get('cache-control'),'public, max-age=0, must-revalidate');assert.equal(response.headers.get('x-content-type-options'),'nosniff');
  const bytes=new Uint8Array(await response.arrayBuffer()),dimensions=imageSize(bytes);assert.equal(dimensions.width,2);assert.equal(dimensions.height,2);
 }assert.deepEqual(new Uint8Array(await (await app.bucket.get('photo.png'))!.arrayBuffer()),PNG_4x4);}finally{await app.worker.dispose();}
});
test('actual workerd endpoint streams originals when the Images binding or transform params are unavailable',async()=>{
 for(const images of [false,true]){const app=await fixture(images);try{
  const response=await app.request(images?'w=0&f=webp':'w=2&f=webp');assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/png');assert.equal(response.headers.get('content-disposition'),'inline');assert.match(response.headers.get('content-security-policy')??'',/^sandbox;/);assert.deepEqual(new Uint8Array(await response.arrayBuffer()),PNG_4x4);
 }finally{await app.worker.dispose();}}
});
