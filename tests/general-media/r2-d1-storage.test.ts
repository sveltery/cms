import { describe, expect, it } from 'vitest';
import { Miniflare } from 'miniflare';
import type { R2Bucket } from '@cloudflare/workers-types';
import { openD1 } from '../../src/lib/server/database/d1.ts';
import { migrateCms } from '../../src/lib/server/database/migrations.ts';
import { MediaRepository, createGeneralMediaBackend } from '../../src/lib/server/general-media/index.ts';
const modules=import.meta.glob('../../src/lib/server/general-media/r2-storage.ts');
describe('Original actual local R2 binding with canonical raw D1 media',()=>{
  it('uploads, deduplicates, reads and deletes actual binding bytes and canonical metadata',async()=>{
    const load=modules['../../src/lib/server/general-media/r2-storage.ts'];
    expect(load,'actual native R2Storage adapter').toBeTypeOf('function');
    const {R2Storage}=await load() as Record<string,any>;
    const runtime=new Miniflare({modules:true,script:'export default { fetch() { return new Response("owned local media bindings"); } }',compatibilityDate:'2026-05-07',r2Buckets:{MEDIA_BUCKET:'native-general-media-r2'},d1Databases:{CMS_DB:'native-general-media-d1'},host:'127.0.0.1',port:0,cf:false});
    const database=openD1(await runtime.getD1Database('CMS_DB'));
    try{
      await migrateCms(database);
      const bucket=await runtime.getR2Bucket('MEDIA_BUCKET');
      const storage=new R2Storage(bucket as unknown as R2Bucket);
      const backend=createGeneralMediaBackend(database,storage);
      const input={filename:'native.pdf',contentType:'application/pdf',base64:btoa('local binding bytes')};
      const uploaded=await backend.upload(input);expect(uploaded.success).toBe(true);
      if(!uploaded.success)throw new Error('Actual binding upload failed');
      const item=uploaded.data.item;
      expect((await new MediaRepository(database).findById(item.id))?.storageKey).toBe(item.storageKey);
      expect(await (await bucket.get(item.storageKey))?.text()).toBe('local binding bytes');
      const repeated=await backend.upload(input);expect(repeated).toMatchObject({success:true,data:{deduplicated:true,item:{id:item.id}}});
      expect(await new Response((await storage.download(item.storageKey)).body).text()).toBe('local binding bytes');
      expect((await backend.delete(item.id)).success).toBe(true);
      expect(await bucket.get(item.storageKey)).toBeNull();
      expect(await new MediaRepository(database).findById(item.id)).toBeNull();
    }finally{await database.close();await runtime.dispose();}
  });
});
