// Retained unsupported Node-built Kit + raw R2 binding host diagnostic.
// Real Worker R2 behavior remains owned by the separate Media Worker family.
// Original native composition acceptance; zero copied Source/authentication credit.
// Signed WebAuthn setup/login, real media upload and actual Node/D1/R2 persistence.
import test from 'node:test';
import assert from 'node:assert/strict';
import {parse} from 'devalue';
import {passkeyRuntime} from '../helpers/passkey-runtime.ts';
import {webauthnCredential} from '../helpers/webauthn-credential.ts';

const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVQI12P4z8AAAAMBAAX+1O8AAAAASUVORK5CYII=','base64');
for(const target of ['Node','D1'] as const){
 test(`${target}: ordinary signed administrator uploads and retains canonical nested media across reopen`,async()=>{
  const h=await passkeyRuntime(target,{media:true}),browser=h.browser();
  try{
   const credential=webauthnCredential(h.origin);
   const began=await browser.post('/api/setup/admin',{email:'blocks-media@example.com',name:'Blocks media'});assert.equal(began.status,200);
   const registered=await browser.post('/api/setup/admin/verify',{credential:credential.registration((await began.json()).data.options.challenge)});assert.equal(registered.status,200);
   const options=await browser.post('/api/auth/passkey/options',{});assert.equal(options.status,200);
   const authenticated=await browser.post('/api/auth/passkey/verify',{credential:credential.assertion((await options.json()).data.options.challenge,1)});assert.equal(authenticated.status,200);
   const cookies=()=>[...browser.cookies].map(([key,value])=>`${key}=${value}`).join('; ');
   async function mutate(name:string,form:Record<string,string>){
    assert.ok(h.ids[name]);const response=await h.request(`/_app/remote/${h.ids[name]}`,{method:'POST',headers:{origin:h.origin,cookie:cookies()},body:new URLSearchParams(form)});
    assert.equal(response.status,200);const envelope=await response.json();assert.equal(envelope.type,'result');
    const result=parse(envelope.data)._;assert.equal(result.issues,undefined);return result.result;
   }
   await mutate('createSchemaCollection',{slug:'block_media_pages',label:'Pages',labelSingular:'Page',supports:JSON.stringify(['drafts','revisions'])});
   const createdType=await h.request('/_emdash/api/schema/block-types',{method:'POST',headers:{origin:h.origin,cookie:cookies(),'content-type':'application/json'},body:JSON.stringify({slug:'media_hero',label:'Media hero',fields:[{slug:'heading',label:'Heading',type:'string'},{slug:'photo',label:'Photo',type:'image',options:{darkVariant:true}}]})});
   assert.equal(createdType.status,201);
   await mutate('addBlockSchemaField',{collection:'block_media_pages',slug:'layout',label:'Layout','n:expectedSchemaVersion':'1','allowedTypes[]':'media_hero',maxItems:'20'});
   const pending=await browser.post('/api/media/upload-url',{filename:'nested.png',contentType:'image/png',size:png.length});assert.equal(pending.status,200);
   const upload=(await pending.json()).data;assert.equal(upload.existing,undefined);
   const put=await h.request(upload.uploadUrl,{method:upload.method,headers:{...upload.headers,origin:h.origin,cookie:cookies()},body:png});assert.equal(put.status,200,JSON.stringify({upload,result:await put.clone().text(),diagnostics:h.diagnostics().slice(-3000)}));
   const confirmed=await browser.post(`/api/media/${upload.mediaId}/confirm`,{size:png.length,width:1,height:1});assert.equal(confirmed.status,200);
   const metadata=await h.request(`/api/media/${upload.mediaId}`,{method:'PUT',headers:{origin:h.origin,cookie:cookies(),'content-type':'application/json'},body:JSON.stringify({alt:'Nested real image',caption:'Retained caption',focalX:0.25,focalY:0.75})});assert.equal(metadata.status,200);
   const selected=(await metadata.json()).data.item;
   const dark={provider:'external',id:'',src:'https://example.com/dark.png'};
   const input={layout:[{_type:'media_hero',_version:1,_key:'original-key',heading:'Persisted hero',photo:{id:upload.mediaId,focalX:selected.focalX,focalY:selected.focalY,darkVariant:dark}}]};
   const entry=await mutate('createLifecycleContent',{collection:'block_media_pages',locale:'en',data:JSON.stringify(input)});
   const key={collection:'block_media_pages',id:entry.id,locale:'en'};
   const row=(await browser.query('getLifecycleContent',key)).data;
   const photo=row.data.layout[0].photo;
   assert.equal(photo.provider,'local');assert.equal(photo.id,upload.mediaId);assert.equal(photo.src,undefined);
   assert.equal(photo.filename,'nested.png');assert.equal(photo.mimeType,'image/png');assert.equal(photo.width,1);assert.equal(photo.height,1);
   assert.equal(photo.alt,'Nested real image');assert.equal(photo.focalX,0.25);assert.equal(photo.focalY,0.75);
   assert.equal(photo.meta.storageKey,selected.storageKey);assert.equal(photo.meta.caption,'Retained caption');assert.deepEqual(photo.darkVariant,dark);
   assert.equal(photo.blurhash,selected.blurhash??undefined);assert.equal(photo.dominantColor,selected.dominantColor??undefined);
   const assetPath=`/_emdash/api/media/file/${selected.storageKey.split('/').map(encodeURIComponent).join('/')}`;
   const asset=await h.request(assetPath);assert.equal(asset.status,200);assert.deepEqual(Buffer.from(await asset.arrayBuffer()),png);
   await h.restart();
   assert.deepEqual((await browser.query('getLifecycleContent',key)).data.data,row.data);
   const reopened=await h.request(assetPath);assert.equal(reopened.status,200);assert.deepEqual(Buffer.from(await reopened.arrayBuffer()),png);
  }finally{await h.close();}
 });
}
