// Original backend acceptance of the operations used by actual MediaDetails.
// Prepared PNG bytes qualify storage/metadata/new-copy behavior, not Canvas,
// browser cropping, embedded workspace callbacks or field selection persistence.
import {expect,it,vi} from 'vitest';
import {passkeyRuntime} from '../helpers/passkey-runtime';
import {webauthnCredential} from '../helpers/webauthn-credential';
import {mediaRequest,uploadMediaFile} from '../../src/lib/media/client';

for(const target of ['Node','D1'] as const)it(`${target}: detail operations retain edited metadata and create a distinct image copy`,async()=>{
 const h=await passkeyRuntime(target,{media:'local'}),browser=h.browser(),nativeFetch=globalThis.fetch;
 try{
  const credential=webauthnCredential(h.origin);
  const began=await browser.post('/api/setup/admin',{email:'picker-detail@example.com',name:'Picker detail'});expect(began.status).toBe(200);
  const registered=await browser.post('/api/setup/admin/verify',{credential:credential.registration((await began.json()).data.options.challenge)});expect(registered.status).toBe(200);
  const options=await browser.post('/api/auth/passkey/options',{});expect(options.status).toBe(200);
  const authenticated=await browser.post('/api/auth/passkey/verify',{credential:credential.assertion((await options.json()).data.options.challenge,1)});expect(authenticated.status).toBe(200);
  vi.stubGlobal('fetch',(input:RequestInfo|URL,init:RequestInit={})=>{
   const headers=new Headers(init.headers);headers.set('cookie',[...browser.cookies].map(([key,value])=>`${key}=${value}`).join('; '));headers.set('origin',h.origin);
   const url=typeof input==='string'?new URL(input,h.origin):input instanceof URL?input:new URL(input.url,h.origin);
   return nativeFetch(url,{...init,headers});
  });
  const created=await browser.post('/api/media/folders',{name:'Source images'});expect(created.status).toBe(201);
  const folder=(await created.json()).data.item;
  const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVQI12P4z8AAAAMBAAX+1O8AAAAASUVORK5CYII=','base64');
  const original=await uploadMediaFile(new File([bytes],'source.png',{type:'image/png'}),{folderId:folder.id});
  expect(original).toMatchObject({filename:'source.png',mimeType:'image/png',folderId:folder.id,status:'ready',width:1,height:1});
  const edited=await mediaRequest<{item:typeof original}>(`/api/media/${original.id}`,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({alt:'Real edited alt',caption:'Real edited caption',focalX:0.25,focalY:0.75})});
  expect(edited.item).toMatchObject({id:original.id,storageKey:original.storageKey,alt:'Real edited alt',caption:'Real edited caption',focalX:0.25,focalY:0.75});
  const copy=await uploadMediaFile(new File([bytes],'source-cropped.png',{type:'image/png'}),{deduplicate:false,ensureUniqueFilename:true,folderId:folder.id});
  expect(copy.id).not.toBe(original.id);expect(copy.storageKey).not.toBe(original.storageKey);
  expect(copy).toMatchObject({mimeType:'image/png',folderId:folder.id,status:'ready',width:1,height:1});
  const originalAfter=await mediaRequest<{item:typeof original}>(`/api/media/${original.id}`);expect(originalAfter.item).toEqual(edited.item);
  const asset=await nativeFetch(new URL(`/_emdash/api/media/file/${copy.storageKey}`,h.origin));expect(asset.status).toBe(200);expect(new Uint8Array(await asset.arrayBuffer())).toEqual(new Uint8Array(bytes));
 }finally{vi.unstubAllGlobals();await h.close();}
});
