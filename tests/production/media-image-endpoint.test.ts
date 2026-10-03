// Original native stored-image HTTP requirements; zero copied Source callback credit.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {imageSize} from 'image-size';
import {PNG_4x4} from '../../parity/emdash/media/source-fixtures/image-fixtures.ts';
async function fixture(){
 const directory=await mkdtemp(join(tmpdir(),'cms-image-endpoint-')),storage=join(directory,'files');await mkdir(storage);await writeFile(join(storage,'photo.png'),PNG_4x4);
 const built=(path:string)=>import(new URL(`../../.svelte-kit/output/server/${path}`,import.meta.url).href);
 const {manifest}=await built('manifest.js'),{Server}=await built('index.js'),server=new Server(manifest);
 await server.init({env:{SVELTERY_DATABASE_PATH:join(directory,'cms.sqlite'),SVELTERY_PUBLIC_ORIGIN:'http://cms.test',SVELTERY_MEDIA_DIRECTORY:storage}});
 return {request:(path:string)=>server.respond(new Request(`http://cms.test${path}`),{getClientAddress:()=>'127.0.0.1'}),close:()=>rm(directory,{recursive:true,force:true})};
}
test('actual native image endpoint reads storage and emits resized WebP bytes',async()=>{
 const app=await fixture();try{const response=await app.request('/_image?href=http%3A%2F%2Fcms.test%2F_emdash%2Fapi%2Fmedia%2Ffile%2Fphoto.png&w=2&f=webp');assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/webp');const bytes=new Uint8Array(await response.arrayBuffer());assert.ok(bytes.length>12);assert.equal(new TextDecoder().decode(bytes.slice(0,4)),'RIFF');assert.equal(new TextDecoder().decode(bytes.slice(8,12)),'WEBP');const dimensions=imageSize(bytes);assert.equal(dimensions.width,2);assert.equal(dimensions.height,2);}finally{await app.close();}
});
test('actual native image endpoint rejects non-flat and malformed storage keys',async()=>{
 const app=await fixture();try{for(const key of ['_private/photo.png','%2E%2E%2Fphoto.png']){const response=await app.request(`/_image?href=${encodeURIComponent('/_emdash/api/media/file/'+key)}&w=2&f=webp`);assert.equal(response.status,404);}}finally{await app.close();}
});
