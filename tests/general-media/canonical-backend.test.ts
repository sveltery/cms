import { describe, expect, it } from 'vitest';
import { sql } from 'kysely';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openSqlite } from '../../src/lib/server/database/sqlite.ts';
import { migrateCms } from '../../src/lib/server/database/migrations.ts';

const modules = import.meta.glob('../../src/lib/server/general-media/index.ts');
async function backendModule() {
  const load = modules['../../src/lib/server/general-media/index.ts'];
  return load ? await load() as Record<string, any> : null;
}
describe('Original general media on canonical installation', () => {
  it('persists folder, pending upload, confirmation, focal metadata and deletion on provider9', async () => {
    const database = openSqlite(':memory:');
    try {
      await migrateCms(database);
      const module = await backendModule();
      expect(module, 'working canonical general media backend').not.toBeNull();
      const media = new module!.MediaRepository(database);
      const folders = new module!.MediaFolderRepository(database);
      const folder = await folders.create('  Native photos  ');
      const pending = await media.createPending({filename:'native.png',mimeType:'image/png',storageKey:'native.png',folderId:folder.id});
      expect((await media.findMany()).items).toEqual([]);
      const confirmed = await media.confirmUpload(pending.id,{width:4,height:4,size:10,blurhash:'original-blurhash',dominantColor:'rgb(255,0,0)'});
      expect(confirmed).toMatchObject({status:'ready',folderId:folder.id,width:4});
      await media.update(pending.id,{focalX:0.25,focalY:0.75,alt:'Native image'});
      const persisted = await sql<{alt:string;focal_x:number;folder_id:string}>`SELECT alt,focal_x,folder_id FROM _cms_media WHERE id=${pending.id}`.execute(database.db);
      expect(persisted.rows).toEqual([{alt:'Native image',focal_x:0.25,folder_id:folder.id}]);
      await folders.delete(folder.id);
      expect((await media.findById(pending.id))?.folderId).toBeNull();
      expect(await media.deleteWithStorageKey(pending.id)).toBe('native.png');
      expect(await media.findById(pending.id)).toBeNull();
      const tables = await sql<{name:string}>`SELECT name FROM sqlite_master WHERE type='table'`.execute(database.db);
      expect(tables.rows.some(row=>row.name==='media'||row.name.startsWith('_emdash_'))).toBe(false);
    } finally { await database.close(); }
  });
  it('uploads real owned local bytes through the backend and deduplicates the resulting media', async () => {
    const directory = await mkdtemp(join(tmpdir(),'native-general-media-'));
    const database = openSqlite(':memory:');
    try {
      await migrateCms(database);
      const module = await backendModule();
      expect(module, 'working canonical storage-backed upload').not.toBeNull();
      const storage = new module!.LocalStorage({directory,baseUrl:'/media'});
      const backend = module!.createGeneralMediaBackend(database,storage);
      const input = {filename:'document.pdf',base64:btoa('native document bytes'),contentType:'application/pdf',alt:'Document'};
      const uploaded = await backend.upload(input);
      expect(uploaded.success).toBe(true);
      const key = uploaded.data.item.storageKey;
      expect(await new Response((await storage.download(key)).body).text()).toBe('native document bytes');
      expect((await backend.upload(input)).data).toMatchObject({deduplicated:true,item:{id:uploaded.data.item.id}});
      expect((await backend.list()).data.items).toHaveLength(1);
      expect((await backend.delete(uploaded.data.item.id)).success).toBe(true);
      expect(await storage.exists(key)).toBe(false);
    } finally { await database.close(); await rm(directory,{recursive:true,force:true}); }
  });
});
