// CURRENT Native SSR caller acceptance; real canonical SQLite, existing controlled Source Role principal.
// Separate from immutable Source callbacks. No live HTTP, session or credential fixture.
import {expect,it} from 'vitest';
import {openSqlite} from '../../src/lib/server/database/sqlite.ts';
import {migrateCms} from '../../src/lib/server/database/migrations.ts';
import {MediaRepository} from '../../src/lib/server/general-media/index.ts';
import {generalMediaDatabase} from '../../src/lib/server/general-media/storage.ts';
import {handleMediaFolderCreate} from '../../src/lib/server/general-media/upstream/api/handlers/media-folders.ts';
import {servicePrincipal} from '../../src/lib/server/auth/composition.ts';
import {Role} from '../../src/lib/server/auth/roles.ts';
import {load} from '../../src/routes/media/+page.server.ts';
import type {CmsDatabase} from '../../src/lib/server/database/contract.ts';

function pageEvent(database:CmsDatabase,folder?:string) {
  const url=new URL('http://localhost/media');if(folder)url.searchParams.set('folder',folder);
  return {url,locals:{cms:{database,principal:servicePrincipal({id:'source-client-owner',role:Role.EDITOR})}}} as unknown as Parameters<typeof load>[0];
}
type PageData={items:Array<{id:string;url:string}>;totalCount:number;folderId?:string};

it('initializes the actual page with the pinned 35-item Main-library query, excluding named-folder assets',async()=>{
  const database=openSqlite(':memory:');
  try {
    await migrateCms(database);const repository=new MediaRepository(database);
    for(let index=0;index<36;index++)await repository.create({filename:`page-${index}.png`,mimeType:'image/png',storageKey:`page-${index}.png`,authorId:'source-client-owner'});
    const folder=await handleMediaFolderCreate(generalMediaDatabase(database),{name:'Named'});if(!folder.success)throw new Error('Actual folder fixture could not be persisted');
    const named=await repository.create({filename:'named.png',mimeType:'image/png',storageKey:'named.png',folderId:folder.data.item.id,authorId:'source-client-owner'});
    const data=await load(pageEvent(database)) as PageData;
    expect(data.items).toHaveLength(35);expect(data.totalCount).toBe(36);expect(data.items.some(item=>item.id===named.id)).toBe(false);
    expect(data.items.every(item=>item.url.startsWith('/_emdash/api/media/file/'))).toBe(true);
  } finally {await database.close();}
});

it('initializes the actual named-folder URL with only that folder and preserves its identity for the client model',async()=>{
  const database=openSqlite(':memory:');
  try {
    await migrateCms(database);const repository=new MediaRepository(database);
    const folder=await handleMediaFolderCreate(generalMediaDatabase(database),{name:'Named'});if(!folder.success)throw new Error('Actual folder fixture could not be persisted');
    await repository.create({filename:'main.png',mimeType:'image/png',storageKey:'main.png',authorId:'source-client-owner'});
    const named=await repository.create({filename:'named.png',mimeType:'image/png',storageKey:'named.png',folderId:folder.data.item.id,authorId:'source-client-owner'});
    const data=await load(pageEvent(database,folder.data.item.id)) as PageData;
    expect(data.items.map(item=>item.id)).toEqual([named.id]);expect(data.totalCount).toBe(1);expect(data.folderId).toBe(folder.data.item.id);
  } finally {await database.close();}
});
