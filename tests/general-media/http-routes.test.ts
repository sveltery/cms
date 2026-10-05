import { describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openSqlite } from '../../src/lib/server/database/sqlite.ts';
import { migrateCms } from '../../src/lib/server/database/migrations.ts';
import { servicePrincipal } from '../../src/lib/server/auth/composition.ts';
import { Role } from '../../src/lib/server/auth/roles.ts';
import { LocalStorage, MediaRepository } from '../../src/lib/server/general-media/index.ts';
import type { RequestEvent } from '@sveltejs/kit';
import { JPEG_4x4 } from '../../parity/emdash/general-media-source/upstream/packages/core/tests/utils/image-fixtures.ts';
const modules=import.meta.glob('../../src/routes/**/+server.ts');
async function route(path:string):Promise<Record<string,(event:RequestEvent)=>Promise<Response>>|null> {
  const load=modules['../../src/routes/'+path+'/+server.ts'];
  return load ? await load() as Record<string,(event:RequestEvent)=>Promise<Response>> : null;
}
async function fixture() {
  const directory=await mkdtemp(join(tmpdir(),'native-media-route-unit-'));
  const database=openSqlite(':memory:');await migrateCms(database);
  const storage=new LocalStorage({directory,baseUrl:'/media'});
  const event=(request:Request,role:number|null,params:Record<string,string>={},enabled=true,id='native-media-user')=>({
    request,url:new URL(request.url),params,
    locals:{cms:{database,storage,mutationsEnabled:enabled,principal:role===null?null:servicePrincipal({id,role:role as typeof Role.ADMIN})},cmsRuntime:{publicOrigin:'http://localhost',basePath:'',rpName:'CMS'}}
  }) as unknown as RequestEvent;
  return {database,storage,event,async close(){await database.close();await rm(directory,{recursive:true,force:true});}};
}
describe('Original native media route module calls using controlled principals',()=>{
  it('streams a pending local upload, confirms its bytes, and replaces the same canonical media key',async()=>{
    const owned=await fixture();
    try{
      const uploadUrl=await route('api/media/upload-url');expect(uploadUrl,'native upload URL endpoint').not.toBeNull();
      const response=await uploadUrl!.POST(owned.event(new Request('http://localhost/api/media/upload-url',{method:'POST',headers:{Origin:'http://localhost','Content-Type':'application/json'},body:JSON.stringify({filename:'stream.jpg',contentType:'image/jpeg',size:JPEG_4x4.length})}),Role.CONTRIBUTOR));
      expect(response.status).toBe(200);const {data}=await response.json();
      expect(data.uploadUrl).toBe('/_emdash/api/media/'+data.mediaId+'/upload');
      const upload=await route('_emdash/api/media/[id]/upload');expect(upload,'unchanged Source fallback upload URL').not.toBeNull();
      const uploadResponse=await upload!.PUT(owned.event(new Request('http://localhost'+data.uploadUrl,{method:'PUT',headers:{Origin:'http://localhost','Content-Type':'image/jpeg'},body:new Uint8Array(JPEG_4x4)}),Role.CONTRIBUTOR,{id:data.mediaId}));
      expect(uploadResponse.status).toBe(200);
      const confirm=await route('api/media/[id]/confirm');expect(confirm,'native upload confirmation endpoint').not.toBeNull();
      expect((await confirm!.POST(owned.event(new Request('http://localhost/api/media/'+data.mediaId+'/confirm',{method:'POST',headers:{Origin:'http://localhost'}}),Role.CONTRIBUTOR,{id:data.mediaId}))).status).toBe(200);
      const repository=new MediaRepository(owned.database);const item=await repository.findById(data.mediaId);expect(item?.status).toBe('ready');
      const key=item!.storageKey;
      const replace=await route('api/media/[id]/replace');expect(replace,'native same-key replacement endpoint').not.toBeNull();
      const replacement=new Uint8Array([...JPEG_4x4,0]);
      const body=new FormData();body.set('file',new File([replacement],'stream.jpg',{type:'image/jpeg'}));
      body.set('width','4');body.set('height','4');
      expect((await replace!.PUT(owned.event(new Request('http://localhost/api/media/'+data.mediaId+'/replace',{method:'PUT',headers:{Origin:'http://localhost'},body}),Role.AUTHOR,{id:data.mediaId}))).status).toBe(200);
      expect((await repository.findById(data.mediaId))?.storageKey).toBe(key);
      expect(new Uint8Array(await new Response((await owned.storage.download(key)).body).arrayBuffer())).toEqual(replacement);
      expect((await repository.findById(data.mediaId))?.size).toBe(replacement.length);
    }finally{await owned.close();}
  });
  it('enforces existing mutation opt-in and origin before a real canonical folder write',async()=>{
    const owned=await fixture();
    try{
      const folders=await route('api/media/folders');expect(folders,'native media folder route').not.toBeNull();
      const request=(origin='http://localhost')=>new Request('http://localhost/api/media/folders',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify({name:'Native folder'})});
      expect((await folders!.POST(owned.event(request(),Role.EDITOR,{},false))).status).toBe(503);
      expect((await folders!.POST(owned.event(request('http://elsewhere.invalid'),Role.EDITOR))).status).toBe(403);
      expect((await folders!.POST(owned.event(request(),Role.AUTHOR))).status).toBe(403);
      const created=await folders!.POST(owned.event(request(),Role.EDITOR));expect(created.status).toBe(201);
      expect((await created.json()).data.item.name).toBe('Native folder');
      expect((await folders!.GET(owned.event(new Request('http://localhost/api/media/folders'),Role.SUBSCRIBER))).status).toBe(200);
    }finally{await owned.close();}
  });
  it('stores multipart bytes and serves the unchanged Source URL with public file guards',async()=>{
    const owned=await fixture();
    try{
      const media=await route('api/media');expect(media,'native multipart media endpoint').not.toBeNull();
      const body=new FormData();body.set('file',new File(['ordinary media bytes'],'native.pdf',{type:'application/pdf'}));
      const response=await media!.POST(owned.event(new Request('http://localhost/api/media',{method:'POST',headers:{Origin:'http://localhost'},body}),Role.CONTRIBUTOR));
      expect(response.status).toBe(201);
      const {data}=await response.json();expect(data.item.url).toBe('/_emdash/api/media/file/'+data.item.storageKey);
      const file=await route('_emdash/api/media/file/[...key]');expect(file,'Source media file URL compatibility route').not.toBeNull();
      const served=await file!.GET(owned.event(new Request('http://localhost'+data.item.url),null,{key:data.item.storageKey}));
      expect(served.status).toBe(200);expect(await served.text()).toBe('ordinary media bytes');
      expect(served.headers.get('Content-Disposition')).toBe('attachment');
      expect(served.headers.get('Content-Security-Policy')).toContain('sandbox');
      expect((await file!.GET(owned.event(new Request('http://localhost/_emdash/api/media/file/backups/private.json'),null,{key:'backups/private.json'}))).status).toBe(404);
    }finally{await owned.close();}
  });
  it('preserves item ownership and reader-only asset authorization against stored metadata',async()=>{
    const owned=await fixture();
    try{
      const media=new MediaRepository(owned.database);await owned.storage.upload({key:'native.png',body:new Uint8Array([1,2,3]),contentType:'image/png'});
      const item=await media.create({filename:'native.png',mimeType:'image/png',storageKey:'native.png',authorId:'actual-owner'});
      const one=await route('api/media/[id]');expect(one,'native media item endpoint').not.toBeNull();
      const request=()=>new Request('http://localhost/api/media/'+item.id,{method:'PUT',headers:{'Content-Type':'application/json',Origin:'http://localhost'},body:JSON.stringify({alt:'Changed'})});
      expect((await one!.PUT(owned.event(request(),Role.AUTHOR,{id:item.id},true,'other-owner'))).status).toBe(403);
      expect((await media.findById(item.id))?.alt).toBeNull();
      expect((await one!.PUT(owned.event(request(),Role.AUTHOR,{id:item.id},true,'actual-owner'))).status).toBe(200);
      expect((await media.findById(item.id))?.alt).toBe('Changed');
      const asset=await route('api/media/asset/[id]/[filename]');expect(asset,'private media asset endpoint').not.toBeNull();
      const event=()=>owned.event(new Request('http://localhost/api/media/asset/'+item.id+'/native.png'),Role.SUBSCRIBER,{id:item.id,filename:'native.png'});
      expect((await asset!.GET(event())).status).toBe(200);
      const anonymous=event();anonymous.locals.cms!.principal=null;expect((await asset!.GET(anonymous)).status).toBe(401);
      const wrong=event();wrong.params.filename='other.png';expect((await asset!.GET(wrong)).status).toBe(404);
    }finally{await owned.close();}
  });
});
