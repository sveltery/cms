// CURRENT Native media preview/cache acceptance with the real canonical read API.
// Separate from immutable TipTap/FieldHost tests; no save/hydration or storage-write credit.
import {expect,it,vi} from 'vitest';
import {QueryClient} from '@tanstack/react-query';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openSqlite} from '../../src/lib/server/database/sqlite.ts';
import {migrateCms} from '../../src/lib/server/database/migrations.ts';
import {MediaRepository,LocalStorage} from '../../src/lib/server/general-media/index.ts';
import {fetchMediaItem,replaceMediaImage} from '../../src/lib/media/source/api/media.ts';
import {computeContentHash} from '../../src/lib/media/hash.ts';
import {JPEG_4x4} from '../../parity/emdash/general-media-source/upstream/packages/core/tests/utils/image-fixtures.ts';
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
    const reader=vi.spyOn(globalThis,'fetch'),sourceAttrs=Object.freeze({mediaId:item.id,provider:'local',src:'/_emdash/api/media/file/current.png'});
    const {observeImageMediaPreview}=await mediaPreviewModule();const current=observeImageMediaPreview(queryClient,sourceAttrs);preview=current;
    current.start();
    await vi.waitFor(()=>expect(current.snapshot().src).toBe('/_emdash/api/media/file/current.png?_emdash_media=sha1%3Acropped'));
    expect(queryClient.getQueryData(['media',item.id])).toMatchObject({id:item.id,contentHash:'sha1:cropped'});
    expect(reader.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
    expect(sourceAttrs).toEqual({mediaId:item.id,provider:'local',src:'/_emdash/api/media/file/current.png'});
  } finally {preview?.dispose();queryClient.clear();vi.restoreAllMocks();vi.unstubAllGlobals();await database.close();}
});

it('keeps gallery preview reads disabled and observes the real shared image cache with pinned stored-URL semantics',async()=>{
  const database=openSqlite(':memory:');const queryClient=new QueryClient({defaultOptions:{queries:{retry:false}}});let preview:{dispose():void}|undefined;
  try {
    await migrateCms(database);bindCurrentMediaApi(database);
    const item=await new MediaRepository(database).create({filename:'gallery.png',mimeType:'image/png',storageKey:'gallery.png',contentHash:'sha1:current',authorId:'source-client-owner'});
    const reader=vi.spyOn(globalThis,'fetch'),image=Object.freeze({asset:{_ref:item.id,provider:'local',url:'/_emdash/api/media/file/stored-gallery.png'}});
    const {observeGalleryMediaPreview}=await mediaPreviewModule();const current=observeGalleryMediaPreview(queryClient,image);preview=current;
    current.start();expect(current.snapshot().src).toBe('/_emdash/api/media/file/stored-gallery.png');expect(reader).not.toHaveBeenCalled();
    await queryClient.fetchQuery({queryKey:['media',item.id],queryFn:({signal})=>fetchMediaItem(item.id,{signal})});
    await vi.waitFor(()=>expect(current.snapshot().src).toBe('/_emdash/api/media/file/stored-gallery.png?_emdash_media=sha1%3Acurrent'));
    expect(reader).toHaveBeenCalledTimes(1);expect(image.asset.url).toBe('/_emdash/api/media/file/stored-gallery.png');
  } finally {preview?.dispose();queryClient.clear();vi.restoreAllMocks();vi.unstubAllGlobals();await database.close();}
});

it('refreshes image and disabled gallery consumers after actual byte replacement preserves canonical identity and invalidates their shared cache',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'native-editor-media-cache-'));
  const database=openSqlite(':memory:');
  const storage=new LocalStorage({directory,baseUrl:'/_emdash/api/media/file'});
  const queryClient=new QueryClient({defaultOptions:{queries:{retry:false}}});
  let image:{dispose():void}|undefined,gallery:{dispose():void}|undefined;
  try {
    await migrateCms(database);bindCurrentMediaApi(database,storage);
    const original=new Uint8Array(JPEG_4x4),replacement=new Uint8Array([...JPEG_4x4,1]);
    const originalHash=await computeContentHash(original),replacementHash=await computeContentHash(replacement);
    await storage.upload({key:'unchanged.jpg',body:original,contentType:'image/jpeg'});
    const repository=new MediaRepository(database);
    const item=await repository.create({filename:'unchanged.jpg',mimeType:'image/jpeg',storageKey:'unchanged.jpg',contentHash:originalHash,authorId:'source-client-owner'});
    const storedUrl='/_emdash/api/media/file/unchanged.jpg';
    const attributes=Object.freeze({mediaId:item.id,provider:'local',src:storedUrl});
    const asset=Object.freeze({_ref:item.id,provider:'local',url:storedUrl});
    const {observeImageMediaPreview,observeGalleryMediaPreview}=await mediaPreviewModule();
    const imageView=observeImageMediaPreview(queryClient,attributes);image=imageView;
    const galleryView=observeGalleryMediaPreview(queryClient,{asset});gallery=galleryView;
    const reader=vi.spyOn(globalThis,'fetch');
    galleryView.start();expect(reader).not.toHaveBeenCalled();imageView.start();
    await vi.waitFor(()=>expect(galleryView.snapshot().currentMedia?.contentHash).toBe(originalHash));
    const replaced=await replaceMediaImage(item.id,new File([replacement],'unchanged.jpg',{type:'image/jpeg'}),{width:4,height:4});
    expect(replaced).toMatchObject({id:item.id,storageKey:item.storageKey,contentHash:replacementHash,width:4,height:4});
    await queryClient.invalidateQueries({queryKey:['media']});
    const versioned=`${storedUrl}?_emdash_media=${encodeURIComponent(replacementHash)}`;
    await vi.waitFor(()=>{expect(imageView.snapshot().src).toBe(versioned);expect(galleryView.snapshot().src).toBe(versioned);});
    expect(await repository.findById(item.id)).toMatchObject({id:item.id,storageKey:'unchanged.jpg',contentHash:replacementHash,size:replacement.length});
    expect(new Uint8Array(await new Response((await storage.download(item.storageKey)).body).arrayBuffer())).toEqual(replacement);
    expect(reader.mock.calls.map(([,init])=>init?.method??'GET')).toEqual(['GET','PUT','GET']);
    expect(attributes).toEqual({mediaId:item.id,provider:'local',src:storedUrl});expect(asset.url).toBe(storedUrl);
  } finally {image?.dispose();gallery?.dispose();queryClient.clear();vi.restoreAllMocks();vi.unstubAllGlobals();await database.close();await rm(directory,{recursive:true,force:true});}
});
