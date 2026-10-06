// Original Native hosting requirements; zero Source test or framework-env-factory credit.
import {describe,expect,it} from 'vitest';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {RequestEvent} from '@sveltejs/kit';
import {createCmsRuntime} from '../../src/lib/server/runtime/composition.ts';
import {runtimeConfiguration} from '../../src/lib/server/runtime/environment.ts';
import {createGeneralMediaBackend,LocalStorage} from '../../src/lib/server/general-media/index.ts';

function event():RequestEvent {
  return {request:new Request('https://untrusted-host.invalid/cms/'),url:new URL('https://untrusted-host.invalid/cms/'),locals:{},cookies:{get:()=>undefined}} as unknown as RequestEvent;
}

describe('Original trusted Node environment media storage',()=>{
  it('opts into reversible local bytes with trusted origin and Kit base path while preserving disabled writes',async()=>{
    const directory=await mkdtemp(join(tmpdir(),'native-media-environment-'));
    const mediaDirectory=join(directory,'media');
    const runtime=createCmsRuntime(()=>runtimeConfiguration({SVELTERY_DATABASE_PATH:join(directory,'cms.db'),SVELTERY_PUBLIC_ORIGIN:'https://cms.example.test',SVELTERY_MEDIA_DIRECTORY:mediaDirectory,SVELTERY_MUTATIONS_ENABLED:'false'},undefined,'/cms'));
    try{
      const current=event();
      await runtime.handle({event:current,resolve:async()=>new Response('controlled unit resolve')});
      const storage=current.locals.cms?.storage;
      expect(storage,'usable opt-in local media storage on the actual configured runtime').toBeInstanceOf(LocalStorage);
      expect(current.locals.cms?.mutationsEnabled).toBe(false);
      expect(current.locals.cms?.principal).toBeNull();
      const backend=createGeneralMediaBackend(current.locals.cms!.database,storage!);
      const result=await backend.upload({filename:'ordinary.pdf',base64:btoa('owned environment media bytes'),contentType:'application/pdf'});
      expect(result.success).toBe(true);
      if(!result.success)throw new Error(result.error.message);
      const key=result.data.item.storageKey;
      expect(storage!.getPublicUrl(key)).toBe('https://cms.example.test/cms/api/media/file/'+key);
      expect(await readFile(join(mediaDirectory,key),'utf8')).toBe('owned environment media bytes');
      expect(await new Response((await storage!.download(key)).body).text()).toBe('owned environment media bytes');
      expect((await backend.delete(result.data.item.id)).success).toBe(true);
      expect(await storage!.exists(key)).toBe(false);
    }finally{await runtime.close();await rm(directory,{recursive:true,force:true});}
  });

  it('rejects filesystem media selection on the D1 hosting configuration before opening any database',()=>{
    const binding={prepare:()=>{throw new Error('configuration must not prepare SQL');},batch:()=>{throw new Error('configuration must not write SQL');}};
    expect(()=>runtimeConfiguration({SVELTERY_PUBLIC_ORIGIN:'https://cms.example.test',SVELTERY_MEDIA_DIRECTORY:'./media'},{env:{CMS_DB:binding}})).toThrow(/SVELTERY_MEDIA_DIRECTORY.*Node/);
  });

  it('keeps storage opt-in absent when the media directory is omitted and cannot enable an unconfigured CMS',()=>{
    expect(runtimeConfiguration({SVELTERY_DATABASE_PATH:'./cms.db',SVELTERY_PUBLIC_ORIGIN:'https://cms.example.test'})?.storage).toBeUndefined();
    expect(runtimeConfiguration({SVELTERY_MEDIA_DIRECTORY:'./media',SVELTERY_PUBLIC_ORIGIN:'https://cms.example.test'})).toBeUndefined();
  });

  it('preserves the exact explicitly injected storage owner',async()=>{
    const directory=await mkdtemp(join(tmpdir(),'native-media-explicit-storage-'));
    const supplied=new LocalStorage({directory:join(directory,'supplied'),baseUrl:'/supplied'});
    const runtime=createCmsRuntime(()=>({...runtimeConfiguration({SVELTERY_DATABASE_PATH:join(directory,'cms.db'),SVELTERY_PUBLIC_ORIGIN:'https://cms.example.test',SVELTERY_MEDIA_DIRECTORY:join(directory,'environment')})!,storage:supplied}));
    try{
      const current=event();
      await runtime.handle({event:current,resolve:async()=>new Response('controlled unit resolve')});
      expect(current.locals.cms?.storage).toBe(supplied);
      expect(current.locals.cms?.storage?.getPublicUrl('image.png')).toBe('/supplied/image.png');
    }finally{await runtime.close();await rm(directory,{recursive:true,force:true});}
  });
});
