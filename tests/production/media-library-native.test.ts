// Supplemental native HTTP/storage requirements. Zero copied source callback credit.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {schemaAdminRemotes} from '../helpers/schema-admin-remotes.ts';
const png=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jhRkAAAAASUVORK5CYII=','base64'));
async function fixture(target:'Node'|'D1',enabled=true){
 const directory=await mkdtemp(join(tmpdir(),'cms-media-library-'));
 const app=await schemaAdminRemotes(target,enabled,{configureRequest(event){event.platform={env:{SVELTERY_MEDIA_DIRECTORY:directory}};}});
 const upload=async(session:string|null='admin',filename='photo.png')=>{
  const body=new FormData();body.set('file',new File([png],filename,{type:'image/png'}));
  return app.request('/api/media',session,{method:'POST',headers:{origin:app.origin},body});
 };
 return {...app,directory,upload,async close(){await app.close();await rm(directory,{recursive:true,force:true});}};
}
for(const target of ['Node','D1'] as const){
 test(`${target}: native media authentication, role and origin gates precede upload parsing`,async()=>{
  const h=await fixture(target);
  try{
   for(const [session,status] of [[null,401],['subscriber',403]] as const){
    const response=await h.request('/api/media',session,{method:'POST',headers:{origin:h.origin},body:'invalid multipart'});
    assert.equal(response.status,status);
   }
   const foreign=await h.request('/api/media','admin',{method:'POST',headers:{origin:'https://foreign.example'},body:'invalid multipart'});
   assert.equal(foreign.status,403);
   assert.equal((await h.database.db.selectFrom('media' as never).selectAll().execute()).length,0);
  }finally{await h.close();}
 });
 test(`${target}: native upload persists bytes and metadata, deduplicates and survives restart`,async()=>{
  const h=await fixture(target);
  try{
   const response=await h.upload();assert.equal(response.status,201);
   const item=(await response.json()).data.item;
   assert.equal(item.filename,'photo.png');assert.equal(item.width,1);assert.equal(item.height,1);
   assert.ok(item.blurhash);assert.match(item.dominantColor,/^#/);
   assert.deepEqual(new Uint8Array(await readFile(join(h.directory,item.storageKey))),png);
   const duplicate=await h.upload();assert.equal(duplicate.status,200);assert.equal((await duplicate.json()).data.item.id,item.id);
   await h.restart();
   const list=await h.request('/api/media?page=1&limit=10');assert.equal(list.status,200);
   const data=(await list.json()).data;assert.equal(data.totalCount,1);assert.equal(data.items[0].id,item.id);
   const stored=await h.request(item.url);assert.equal(stored.status,200);assert.deepEqual(new Uint8Array(await stored.arrayBuffer()),png);
  }finally{await h.close();}
 });
 test(`${target}: native media ownership, focal metadata and folder deletion preserve real rows`,async()=>{
  const h=await fixture(target);
  try{
   const response=await h.upload('author');assert.equal(response.status,201);const item=(await response.json()).data.item;
   const folder=await h.request('/api/media/folders','admin',{method:'POST',headers:{origin:h.origin,'content-type':'application/json'},body:JSON.stringify({name:'Images'})});
   assert.equal(folder.status,201);const folderId=(await folder.json()).data.item.id;
   const update=(session:string,body:unknown)=>h.request(`/api/media/${item.id}`,session,{method:'PUT',headers:{origin:h.origin,'content-type':'application/json'},body:JSON.stringify(body)});
   assert.equal((await update('author',{alt:'A tiny image',folderId,focalX:0.25,focalY:0.75})).status,200);
   assert.equal((await update('subscriber',{alt:'Denied'})).status,403);
   assert.equal((await update('author',{focalX:0.2})).status,400);
   const deletion=await h.request(`/api/media/folders/${folderId}`,'admin',{method:'DELETE',headers:{origin:h.origin}});assert.equal(deletion.status,200);
   const result=await h.request(`/api/media/${item.id}`);assert.equal(result.status,200);
   const edited=(await result.json()).data.item;assert.equal(edited.folderId,null);assert.equal(edited.alt,'A tiny image');assert.equal(edited.focalX,0.25);assert.equal(edited.focalY,0.75);
  }finally{await h.close();}
 });
 test(`${target}: disabled media mutations reject before storage`,async()=>{
  const h=await fixture(target,false);
  try{assert.equal((await h.upload()).status,503);assert.equal((await h.database.db.selectFrom('media' as never).selectAll().execute()).length,0);}
  finally{await h.close();}
 });
}
