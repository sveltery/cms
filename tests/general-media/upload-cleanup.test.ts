import {describe,expect,it} from 'vitest';
import {Miniflare} from 'miniflare';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openSqlite} from '../../src/lib/server/database/sqlite.ts';
import {openD1} from '../../src/lib/server/database/d1.ts';
import {migrateCms} from '../../src/lib/server/database/migrations.ts';
import type {CmsDatabase} from '../../src/lib/server/database/contract.ts';
import type {Kysely} from 'kysely';
import type {MediaTable} from '../../src/lib/server/general-media/upstream/database/types.ts';
import {LocalStorage,MediaRepository} from '../../src/lib/server/general-media/index.ts';
const modules=import.meta.glob('../../src/lib/server/general-media/cleanup.ts');
describe('Original trusted canonical upload cleanup using owned local bytes',()=>{
  it.each(['sqlite','d1'] as const)('%s removes abandoned pending and orphan attempt bytes while retaining a ready shared key',async kind=>{
    const directory=await mkdtemp(join(tmpdir(),'native-media-cleanup-'));
    const runtime=kind==='d1'?new Miniflare({modules:true,script:'export default { fetch() { return new Response("owned local cleanup fixture"); } }',compatibilityDate:'2026-05-07',d1Databases:{CMS_DB:'native-media-cleanup-db'},host:'127.0.0.1',port:0,cf:false}):undefined;
    const database:CmsDatabase=runtime?openD1(await runtime.getD1Database('CMS_DB')):openSqlite(':memory:');
    try{
      await migrateCms(database);
      const load=modules['../../src/lib/server/general-media/cleanup.ts'];expect(load,'trusted actual media upload cleanup operator').toBeTypeOf('function');
      const {cleanupMediaUploads}=await load() as Record<string,any>;
      const storage=new LocalStorage({directory,baseUrl:'/media'});
      const repository=new MediaRepository(database);
      for(const key of ['abandoned.bin','shared.bin','orphan.bin'])await storage.upload({key,body:new TextEncoder().encode(key),contentType:'application/octet-stream'});
      const pending=await repository.createPending({filename:'abandoned.bin',mimeType:'application/octet-stream',storageKey:'abandoned.bin'});
      const sharedPending=await repository.createPending({filename:'shared.bin',mimeType:'application/octet-stream',storageKey:'shared.bin'});
      const ready=await repository.create({filename:'shared.bin',mimeType:'application/octet-stream',storageKey:'shared.bin'});
      await (database.db as unknown as Kysely<{_cms_media:MediaTable}>).updateTable('_cms_media').set({created_at:'2000-01-01T00:00:00.000Z'}).where('id','in',[pending.id,sharedPending.id]).execute();
      await repository.trackStorageKeyForCleanup('deleted-fixture-media','orphan.bin');
      expect(await cleanupMediaUploads(database,storage)).toEqual({pendingUploads:1,pendingUploadFiles:1,uploadAttempts:1});
      expect(await repository.findById(pending.id)).toBeNull();expect(await repository.findById(sharedPending.id)).toBeNull();
      expect((await repository.findById(ready.id))?.storageKey).toBe('shared.bin');
      expect(await storage.exists('abandoned.bin')).toBe(false);expect(await storage.exists('orphan.bin')).toBe(false);
      expect(await new Response((await storage.download('shared.bin')).body).text()).toBe('shared.bin');
      expect(await repository.hasUploadAttempt('orphan.bin')).toBe(false);
    }finally{await database.close();await runtime?.dispose();await rm(directory,{recursive:true,force:true});}
  });
});
