// Original actual API composition acceptance, zero copied Source/auth/browser credit.
import {expect,it,vi} from 'vitest';
import {passkeyRuntime} from '../helpers/passkey-runtime';
import {webauthnCredential} from '../helpers/webauthn-credential';
import {uploadMedia,fetchMediaList,fetchMediaFolders,fetchMediaFolder,updateMedia,fetchPickerCurrentUser} from '../../src/lib/media/picker-client';
import {mediaPermissionsForUser} from '../../src/lib/media/permissions';

it('retains actual signed user, deduplicated file metadata, folder and persisted API results',async()=>{
 const h=await passkeyRuntime('Node',{media:true}),browser=h.browser(),nativeFetch=globalThis.fetch;
 try{
  const credential=webauthnCredential(h.origin);
  const began=await browser.post('/api/setup/admin',{email:'picker-api@example.com',name:'Picker API'});expect(began.status).toBe(200);
  const registered=await browser.post('/api/setup/admin/verify',{credential:credential.registration((await began.json()).data.options.challenge)});expect(registered.status).toBe(200);
  const options=await browser.post('/api/auth/passkey/options',{});expect(options.status).toBe(200);
  const authenticated=await browser.post('/api/auth/passkey/verify',{credential:credential.assertion((await options.json()).data.options.challenge,1)});expect(authenticated.status).toBe(200);
  vi.stubGlobal('fetch',(input:RequestInfo|URL,init:RequestInit={})=>{
   const headers=new Headers(init.headers);headers.set('cookie',[...browser.cookies].map(([key,value])=>`${key}=${value}`).join('; '));headers.set('origin',h.origin);
   const url=typeof input==='string'?new URL(input,h.origin):input instanceof URL?input:new URL(input.url,h.origin);
   return nativeFetch(url,{...init,headers});
  });
  const user=await fetchPickerCurrentUser();expect(user?.id).toBeTypeOf('string');expect(user?.role).toBe(50);
  expect(mediaPermissionsForUser(user)).toEqual(expect.arrayContaining(['media:read','media:upload','media:edit_any']));
  const bytes=new TextEncoder().encode('%PDF-1.4\nactual picker API\n%%EOF'),file=new File([bytes],'picker-roundtrip.pdf',{type:'application/pdf'});
  const item=await uploadMedia(file);expect(item).toMatchObject({filename:file.name,mimeType:file.type,size:file.size});
  expect(await uploadMedia(file)).toEqual(item);
  const initial=await fetchMediaList({page:1,limit:12,search:'picker-roundtrip',mimeType:['application/pdf'],folderId:null});
  expect(initial.totalCount).toBe(1);expect(initial.items).toEqual([item]);
  const created=await browser.post('/api/media/folders',{name:'Picker documents'});expect(created.status).toBe(201);
  const folder=(await created.json()).data.item;
  expect((await fetchMediaFolders({limit:100,search:'Picker documents'})).items).toContainEqual(expect.objectContaining({id:folder.id,name:folder.name}));
  expect(await fetchMediaFolder(folder.id)).toMatchObject({id:folder.id,name:folder.name});
  const moved=await h.request(`/api/media/${item.id}`,{method:'PUT',headers:{origin:h.origin,cookie:[...browser.cookies].map(([key,value])=>`${key}=${value}`).join('; '),'content-type':'application/json'},body:JSON.stringify({folderId:folder.id,alt:'Real file alt',caption:'Real file caption'})});expect(moved.status).toBe(200);
  const updated=await updateMedia(item.id,{width:320,height:240});expect(updated).toMatchObject({id:item.id,alt:'Real file alt',caption:'Real file caption',width:320,height:240});
  expect((await fetchMediaList({folderId:folder.id})).items).toEqual([updated]);
  expect((await fetchMediaList({folderId:null})).items).toEqual([]);
  await h.restart();
  expect((await fetchMediaList({folderId:folder.id})).items).toEqual([updated]);
  const asset=await nativeFetch(new URL(`/_emdash/api/media/file/${item.storageKey}`,h.origin));expect(asset.status).toBe(200);expect(new Uint8Array(await asset.arrayBuffer())).toEqual(bytes);
 }finally{vi.unstubAllGlobals();await h.close();}
});
