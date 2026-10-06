// Native framework transport control; zero copied Source callback credit.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

it('imports the actual media repositories in Node strip mode and retains their canonical database owner', () => {
  const result = spawnSync(process.execPath, ['--input-type=module', '--eval', `
    import { openSqlite } from './src/lib/server/database/sqlite.ts';
    import { migrateCms } from './src/lib/server/database/migrations.ts';
    import { generalMediaDatabase } from './src/lib/server/general-media/storage.ts';
    import { MediaRepository } from './src/lib/server/general-media/upstream/database/repositories/media.ts';
    import { MediaFolderRepository } from './src/lib/server/general-media/upstream/database/repositories/media-folders.ts';
    const database = openSqlite(':memory:');
    try {
      await migrateCms(database);
      const db = generalMediaDatabase(database);
      const folders = new MediaFolderRepository(db);
      const media = new MediaRepository(db);
      const folder = await folders.create('  Node strip owner  ');
      const item = await media.create({filename:'node-strip.png',mimeType:'image/png',storageKey:'node-strip.png',folderId:folder.id});
      const persistedFolder = await folders.findById(folder.id);
      const persistedItem = await media.findById(item.id);
      console.log(JSON.stringify({
        folderName:persistedFolder?.name,
        filename:persistedItem?.filename,
        mimeType:persistedItem?.mimeType,
        status:persistedItem?.status,
        sameFolder:persistedItem?.folderId === persistedFolder?.id,
        canonicalMediaRows:(await database.db.selectFrom('_cms_media').select('id').execute()).length,
        canonicalFolderRows:(await database.db.selectFrom('_cms_media_folders').select('id').execute()).length
      }));
    } finally { await database.close(); }
  `], { cwd:fileURLToPath(new URL('../../', import.meta.url)), encoding:'utf8' });
  expect(result.status, result.stderr).toBe(0);
  expect(JSON.parse(result.stdout)).toEqual({
    folderName:'Node strip owner', filename:'node-strip.png', mimeType:'image/png',
    status:'ready', sameFolder:true, canonicalMediaRows:1, canonicalFolderRows:1
  });
});
