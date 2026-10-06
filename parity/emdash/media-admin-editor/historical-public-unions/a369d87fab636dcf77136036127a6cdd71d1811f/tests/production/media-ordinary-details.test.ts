// Original ordinary-principal HTTP/SQL/filesystem acceptance; zero copied Source callback credit.
// Actual Node Kit server plus Node SQLite / workerd D1 SQL, explicitly supported LocalStorage.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {passkeyRuntime} from '../helpers/passkey-runtime.ts';
import {webauthnCredential} from '../helpers/webauthn-credential.ts';
import {PNG_4x4} from '../../parity/emdash/media/source-fixtures/image-fixtures.ts';

const replacementPng=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64'));
for(const target of ['Node','D1'] as const){
 test(`${target}: ordinary media details replacement persists one identity and actual bytes across restart`,async()=>{
  const app=await passkeyRuntime(target,{media:'local'}),browser=app.browser(),credential=webauthnCredential(app.origin);
  async function request(path:string,method='GET',body?:unknown){
   const headers=new Headers({origin:app.origin});
   if(browser.cookies.size)headers.set('cookie',[...browser.cookies].map(([name,value])=>`${name}=${value}`).join('; '));
   const binary=body instanceof Uint8Array||body instanceof FormData;
   if(body!==undefined&&!binary)headers.set('content-type','application/json');
   return app.request(path,{method,headers,...(body===undefined?{}:{body:binary?body as BodyInit:JSON.stringify(body)})});
  }
  async function json(path:string,method='GET',body?:unknown,status=200){
   const response=await request(path,method,body);assert.equal(response.status,status,`${method} ${path}`);
   const envelope=await response.json();assert.equal(envelope.success,true);return envelope.data;
  }
  try{
   const begin=await browser.post('/api/setup/admin',{email:'details@example.com',name:'Media administrator'});assert.equal(begin.status,200);
   const registration=await browser.post('/api/setup/admin/verify',{credential:credential.registration((await begin.json()).data.options.challenge)});assert.equal(registration.status,200);
   assert.equal(browser.cookies.has('cms-session'),false,'ordinary setup does not issue an authenticated session');
   const options=await browser.post('/api/auth/passkey/options',{});assert.equal(options.status,200);
   const login=await browser.post('/api/auth/passkey/verify',{credential:credential.assertion((await options.json()).data.options.challenge)});assert.equal(login.status,200);
   const actor=await json('/api/auth/me');assert.equal(actor.role,50);
   const folder=(await json('/api/media/folders','POST',{name:'Details images'},201)).item;
   const upload=new FormData();upload.set('file',new File([PNG_4x4],'original.png',{type:'image/png'}));
   const original=(await json('/api/media','POST',upload,201)).item;
   assert.equal(original.authorId,actor.id);assert.equal(original.width,4);assert.equal(original.height,4);
   const edited=(await json(`/api/media/${original.id}`,'PUT',{alt:'Preserved alt',caption:'Preserved caption',folderId:folder.id,focalX:0.25,focalY:0.75})).item;
   assert.equal(edited.focalX,0.25);assert.equal(edited.focalY,0.75);
   await json('/api/settings','POST',{logo:{mediaId:original.id,alt:'Site logo'}});
   const previousSettings=await json('/api/settings');assert.equal(previousSettings.logo.width,4);
   const replacement=new FormData();replacement.set('file',new File([replacementPng],'replacement.png',{type:'image/png'}));replacement.set('width','1');replacement.set('height','1');
   const replaced=(await json(`/api/media/${original.id}/replace`,'PUT',replacement)).item;
   assert.equal(replaced.id,original.id);assert.equal(replaced.storageKey,original.storageKey);assert.equal(replaced.filename,original.filename);
   assert.equal(replaced.width,1);assert.equal(replaced.height,1);assert.equal(replaced.alt,'Preserved alt');assert.equal(replaced.caption,'Preserved caption');assert.equal(replaced.folderId,folder.id);
   assert.equal(replaced.authorId,actor.id);assert.equal(replaced.focalX,null);assert.equal(replaced.focalY,null);assert.equal(replaced.blurhash,null);assert.equal(replaced.dominantColor,null);
   assert.equal(replaced.contentHash,`sha1:${createHash('sha1').update(replacementPng).digest('hex')}`);
   const asset=await request(replaced.url);assert.equal(asset.status,200);assert.deepEqual(new Uint8Array(await asset.arrayBuffer()),replacementPng);
   assert.deepEqual(new Uint8Array(await readFile(join(app.directory,'media-local',replaced.storageKey))),replacementPng);
   const currentSettings=await json('/api/settings');assert.equal(currentSettings.logo.width,1);assert.equal(currentSettings.logo.height,1);
   const rows=await (await app.database()).db.selectFrom('media' as never).selectAll().execute() as any[];
   assert.equal(rows.length,1);assert.equal(rows[0].id,original.id);assert.equal(rows[0].storage_key,original.storageKey);
   await app.restart();
   assert.equal((await json('/api/auth/me')).id,actor.id);
   const restored=(await json(`/api/media/${original.id}`)).item;assert.equal(restored.width,1);assert.equal(restored.height,1);assert.equal(restored.alt,'Preserved alt');assert.equal(restored.folderId,folder.id);
   // The complete pinned single-item GET returns the row, while upload/list/replace add its URL.
   assert.equal(restored.storageKey,original.storageKey);
   const persisted=await request(original.url);assert.equal(persisted.status,200);assert.deepEqual(new Uint8Array(await persisted.arrayBuffer()),replacementPng);
   const listing=await json('/api/media?page=1&limit=1');assert.equal(listing.totalCount,1);assert.equal(listing.items[0].id,original.id);
  }finally{await app.close();}
 });
}
