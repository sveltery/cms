// CURRENT Native media preview/cache acceptance with the real canonical read API.
// Separate from immutable TipTap/FieldHost tests; no save/hydration or storage-write credit.
import {expect,it,vi} from 'vitest';
import {QueryClient} from '@tanstack/react-query';
import {openSqlite} from '../../src/lib/server/database/sqlite.ts';
import {migrateCms} from '../../src/lib/server/database/migrations.ts';
import {MediaRepository} from '../../src/lib/server/general-media/index.ts';
import {fetchMediaItem} from '../../src/lib/media/source/api/media.ts';
import {bindCurrentMediaApi} from '../helpers/media-admin-editor-current-api.ts';
const modules=import.meta.glob('../../src/lib/media/editor-media-cache.ts');
async function mediaPreviewModule(){
  const load=modules['../../src/lib/media/editor-media-cache.ts'];
  expect(load,'Actual production Image/Gallery media cache consumer').toBeTypeOf('function');
  return await load!() as typeof import('../../src/lib/media/editor-media-cache.ts');
}

it('resolves current local image bytes from the actual API and shared query cache without writing document attributes',async()=>{
  const database=openSqlite(':memory:');const queryClient=new QueryClient({defaultOptions:{queries:{retry:false}}});let preview:{dispose():void}|undefined;
  try {
    await migrateCms(database);bindCurrentMediaApi(database);
    const item=await new MediaRepository(database).create({filename:'current.png',mimeType:'image/png',storageKey:'current.png',contentHash:'sha1:cropped',authorId:'source-client-owner'});
    const reader=vi.spyOn(globalThis,'fetch'),sourceAttrs=Object.freeze({mediaId:item.id,provider:'local',src:'/old-stored-image.png'});
    const {observeImageMediaPreview}=await mediaPreviewModule();const current=observeImageMediaPreview(queryClient,sourceAttrs);preview=current;
    current.start();
    await vi.waitFor(()=>expect(current.snapshot().src).toBe('/_emdash/api/media/file/current.png?_emdash_media=sha1%3Acropped'));
    expect(queryClient.getQueryData(['media',item.id])).toMatchObject({id:item.id,contentHash:'sha1:cropped'});
    expect(reader.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
    expect(sourceAttrs).toEqual({mediaId:item.id,provider:'local',src:'/old-stored-image.png'});
  } finally {preview?.dispose();queryClient.clear();vi.restoreAllMocks();vi.unstubAllGlobals();await database.close();}
});

it('keeps gallery preview reads disabled and observes the real shared image cache with pinned stored-URL semantics',async()=>{
  const database=openSqlite(':memory:');const queryClient=new QueryClient({defaultOptions:{queries:{retry:false}}});let preview:{dispose():void}|undefined;
  try {
    await migrateCms(database);bindCurrentMediaApi(database);
    const item=await new MediaRepository(database).create({filename:'gallery.png',mimeType:'image/png',storageKey:'gallery.png',contentHash:'sha1:current',authorId:'source-client-owner'});
    const reader=vi.spyOn(globalThis,'fetch'),image=Object.freeze({asset:{_ref:item.id,provider:'local',url:'/stored-gallery.png'}});
    const {observeGalleryMediaPreview}=await mediaPreviewModule();const current=observeGalleryMediaPreview(queryClient,image);preview=current;
    current.start();expect(current.snapshot().src).toBe('/stored-gallery.png');expect(reader).not.toHaveBeenCalled();
    await queryClient.fetchQuery({queryKey:['media',item.id],queryFn:({signal})=>fetchMediaItem(item.id,{signal})});
    await vi.waitFor(()=>expect(current.snapshot().src).toBe('/stored-gallery.png?_emdash_media=sha1%3Acurrent'));
    expect(reader).toHaveBeenCalledTimes(1);expect(image.asset.url).toBe('/stored-gallery.png');
  } finally {preview?.dispose();queryClient.clear();vi.restoreAllMocks();vi.unstubAllGlobals();await database.close();}
});
