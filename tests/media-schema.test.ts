// Native requirements, zero upstream declaration credit. Added before provider9.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'kysely';
import { openSqlite } from '../src/lib/server/database/sqlite.ts';
import { migrateCms } from '../src/lib/server/database/migrations.ts';

for (const name of ['media', 'media_folders', '_cms_media_upload_attempts']) {
  test(`canonical fresh migration installs the real ${name} media table`, async () => {
    const database = openSqlite(':memory:');
    try {
      await migrateCms(database);
      const rows = (await sql<{name:string}>`SELECT name FROM sqlite_master WHERE type='table' AND name=${name}`.execute(database.db)).rows;
      assert.equal(rows.length, 1);
    } finally { await database.close(); }
  });
}

test('canonical media schema preserves all upload, placeholder, folder and focal metadata', async () => {
  const database = openSqlite(':memory:');
  try {
    await migrateCms(database);
    const columns = (await sql<{name:string}>`PRAGMA table_info(media)`.execute(database.db)).rows.map(row => row.name);
    for (const column of ['id', 'filename', 'mime_type', 'size', 'width', 'height', 'alt', 'caption', 'storage_key', 'content_hash', 'created_at', 'author_id', 'status', 'blurhash', 'dominant_color', 'folder_id', 'focal_x', 'focal_y']) assert.ok(columns.includes(column), `missing ${column}`);
  } finally { await database.close(); }
});
