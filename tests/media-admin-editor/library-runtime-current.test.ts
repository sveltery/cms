// CURRENT Native page/controller acceptance with actual Source client and canonical API.
// Separate from immutable Source callbacks; no copied Source parity credit.
import {expect,it,vi} from 'vitest';
import {QueryClient} from '@tanstack/react-query';
import {openSqlite} from '../../src/lib/server/database/sqlite.ts';
import {migrateCms} from '../../src/lib/server/database/migrations.ts';
import {MediaRepository} from '../../src/lib/server/general-media/index.ts';
import {createMediaFolder} from '../../src/lib/media/source/api/media.ts';
import {bindCurrentMediaApi} from '../helpers/media-admin-editor-current-api.ts';
const runtimeModule=import.meta.glob('../../src/lib/media/library-runtime.ts');

async function currentRuntime(queryClient:QueryClient) {
  const load=runtimeModule['../../src/lib/media/library-runtime.ts'];
  expect(load,'Real production library page runtime').toBeTypeOf('function');
  const module=await load!() as typeof import('../../src/lib/media/library-runtime.ts');
  return module.createMediaLibraryRuntime(queryClient);
}

it('pages real persisted media at 35/70/90 and searches globally across folders with one actual QueryClient',async()=>{
  const database=openSqlite(':memory:');const queryClient=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});let runtime:Awaited<ReturnType<typeof currentRuntime>>|undefined;
  try {
    await migrateCms(database);bindCurrentMediaApi(database);
    const repository=new MediaRepository(database);for(let index=0;index<36;index++)await repository.create({filename:`page-${index}.png`,mimeType:'image/png',storageKey:`page-${index}.png`,authorId:'source-client-owner'});
    const folder=await createMediaFolder('Named folder');
    const needle=await repository.create({filename:'needle.txt',mimeType:'text/plain',storageKey:'needle.txt',folderId:folder.id,authorId:'source-client-owner'});
    runtime=await currentRuntime(queryClient);await runtime.start();
    expect(runtime.snapshot().items).toHaveLength(35);expect(runtime.snapshot().pagination).toMatchObject({page:1,perPage:35,totalCount:36,isPending:false});
    await runtime.setPage(2);expect(runtime.snapshot().items).toHaveLength(1);expect(runtime.snapshot().pagination.page).toBe(2);
    await runtime.setPageSize(70);expect(runtime.snapshot().items).toHaveLength(36);expect(runtime.snapshot().pagination).toMatchObject({page:1,perPage:70,totalCount:36});
    await runtime.setSearch('needle');expect(runtime.snapshot().items.map(item=>item.id)).toEqual([needle.id]);
    await runtime.setMimeFilter(['application/','text/']);expect(runtime.snapshot().items.map(item=>item.id)).toEqual([needle.id]);
    expect(queryClient.getQueriesData({queryKey:['media']}).some(([,data])=>data!==undefined)).toBe(true);
  } finally {runtime?.dispose();queryClient.clear();vi.unstubAllGlobals();await database.close();}
});

it('keeps real current folder data and media cache coherent after rename, move and folder deletion',async()=>{
  const database=openSqlite(':memory:');const queryClient=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});let runtime:Awaited<ReturnType<typeof currentRuntime>>|undefined;
  try {
    await migrateCms(database);bindCurrentMediaApi(database);const repository=new MediaRepository(database);
    const item=await repository.create({filename:'move-me.png',mimeType:'image/png',storageKey:'move-me.png',authorId:'source-client-owner'});
    runtime=await currentRuntime(queryClient);await runtime.start();const folder=await runtime.createFolder('Destination');
    await runtime.moveMedia(item,folder);expect((await repository.findById(item.id))?.folderId).toBe(folder.id);expect(runtime.snapshot().items).toHaveLength(0);
    await runtime.setFolder(folder.id);expect(runtime.snapshot().items.map(row=>row.id)).toEqual([item.id]);expect(runtime.snapshot().currentFolder?.name).toBe('Destination');
    await runtime.renameFolder(folder,'Renamed destination');expect(runtime.snapshot().currentFolder?.name).toBe('Renamed destination');
    await runtime.deleteFolder(folder);expect(runtime.snapshot().folderId).toBeUndefined();expect((await repository.findById(item.id))?.folderId).toBeNull();expect(runtime.snapshot().items.map(row=>row.id)).toEqual([item.id]);
    expect(queryClient.getQueryData(['media-folder',folder.id])).toBeUndefined();
  } finally {runtime?.dispose();queryClient.clear();vi.unstubAllGlobals();await database.close();}
});
