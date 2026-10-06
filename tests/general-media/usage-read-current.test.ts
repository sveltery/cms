// Native integration requirement derived from the complete pinned read-route family.
// Zero copied Source callback credit. The immutable family remains in runtime-source.
import {expect,it} from 'vitest';
import {openSqlite} from '../../src/lib/server/database/sqlite.ts';
import {migrateCms} from '../../src/lib/server/database/migrations.ts';
import {MediaRepository} from '../../src/lib/server/general-media/index.ts';
import {generalMediaDatabase} from '../../src/lib/server/general-media/storage.ts';
import {handleMediaUsageDetails} from '../../src/lib/server/general-media/upstream/api/handlers/media-usage-read.ts';

it('reports the pinned invalid-cursor outcome across the actual canonical usage repository boundary',async()=>{
 const database=openSqlite(':memory:');
 try {
  await migrateCms(database);
  const media=await new MediaRepository(database).create({filename:'used.png',mimeType:'image/png',storageKey:'used.png'});
  const result=await handleMediaUsageDetails(generalMediaDatabase(database),media.id,{cursor:'not-a-cursor'});
  expect(result).toEqual(expect.objectContaining({success:false,error:expect.objectContaining({code:'INVALID_CURSOR'})}));
 } finally {await database.close();}
});
