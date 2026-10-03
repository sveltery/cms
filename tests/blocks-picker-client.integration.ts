// Original native client composition tests; zero copied Source/browser/auth credit.
// Complete production uploadMedia invokes actual authenticated built Kit endpoints.
import {expect,test,vi} from 'vitest';
import {passkeyRuntime} from './helpers/passkey-runtime';
import {webauthnCredential} from './helpers/webauthn-credential';
import {uploadMedia} from '../src/lib/media/picker-client';

for(const target of ['Node','D1'] as const){
 test(`${target}: the real picker client uploads a file through authenticated storage`,async()=>{
  const h=await passkeyRuntime(target,{media:'local'}),browser=h.browser(),nativeFetch=globalThis.fetch;
  try{
   const credential=webauthnCredential(h.origin);
   const began=await browser.post('/api/setup/admin',{email:'picker-upload@example.com',name:'Picker upload'});expect(began.status).toBe(200);
   const registered=await browser.post('/api/setup/admin/verify',{credential:credential.registration((await began.json()).data.options.challenge)});expect(registered.status).toBe(200);
   const options=await browser.post('/api/auth/passkey/options',{});expect(options.status).toBe(200);
   const authenticated=await browser.post('/api/auth/passkey/verify',{credential:credential.assertion((await options.json()).data.options.challenge,1)});expect(authenticated.status).toBe(200);
   vi.stubGlobal('fetch',(input:string,init:RequestInit={})=>{
    const headers=new Headers(init.headers);headers.set('cookie',[...browser.cookies].map(([key,value])=>`${key}=${value}`).join('; '));headers.set('origin',h.origin);
    return nativeFetch(new URL(input,h.origin),{...init,headers});
   });
   const bytes=new TextEncoder().encode('%PDF-1.4\nactual picker\n%%EOF');
   const file=new File([bytes],'actual-picker.pdf',{type:'application/pdf'});
   const pendingUpload=uploadMedia(file);
   await expect(pendingUpload).resolves.toMatchObject({filename:'actual-picker.pdf',mimeType:'application/pdf',size:bytes.length});
   const result=await pendingUpload;
   expect(result.storageKey).toBeTypeOf('string');
   const asset=await nativeFetch(new URL(`/_emdash/api/media/file/${result.storageKey}`,h.origin));expect(asset.status).toBe(200);expect(new Uint8Array(await asset.arrayBuffer())).toEqual(bytes);
  }finally{vi.unstubAllGlobals();await h.close();}
 });
}
