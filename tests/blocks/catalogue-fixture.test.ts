// Original supplementary catalogue checks; no copied Source assertion credit.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sql, type Kysely } from 'kysely';
import { openSqlite } from '../../src/lib/server/database/sqlite.ts';
import { openD1 } from '../../src/lib/server/database/d1.ts';
import { migrateCms } from '../../src/lib/server/database/migrations.ts';
import type { Database } from '../../src/lib/server/blocks/upstream/database/types.ts';
import { asyncD1Storage } from '../helpers/async-d1-storage.ts';
import { listTables,listIndexes,listColumns,resetD1Schema } from '../helpers/blocks/source-d1-schema.ts';
for(const runtime of ['node','d1'] as const) test(runtime+' finite catalogue names, bound index lookup and PRAGMA use actual block storage',async()=>{
  const storage=runtime==='d1'?await asyncD1Storage():undefined;
  const database=storage?openD1(storage.binding):openSqlite(':memory:');
  const db=database.db as unknown as Kysely<Database>;
  try {
    await migrateCms(database);
    await sql`CREATE TABLE operator_catalogue (retained TEXT)`.execute(database.db);
    await sql`CREATE TABLE _emdash_operator (retained TEXT)`.execute(database.db);
    const tables=await listTables(db);
    assert.equal(tables.includes('_emdash_block_types') && tables.includes('_emdash_block_type_versions'),true);
    assert.equal(tables.includes('_cms_block_types') || tables.includes('_cms_block_type_versions'),false);
    assert.equal(tables.includes('operator_catalogue') && tables.includes('_emdash_operator'),true);
    assert.deepEqual(await listColumns(db,'_emdash_block_types'),['id','slug','label','description','icon','category','current_version','source','created_at','updated_at']);
    assert.deepEqual(await listColumns(db,'_emdash_block_type_versions'),['id','block_type_id','version','fields','fingerprint','created_at','updated_at']);
    assert.deepEqual(await listIndexes(db,'_emdash_block_type_versions'),['idx_block_type_versions_type','idx_block_type_versions_type_version']);
    assert.deepEqual(await listColumns(db,'operator_catalogue'),['retained']);
    assert.deepEqual(await listColumns(db,'_emdash_operator'),['retained']);
    await resetD1Schema(db);
    assert.deepEqual(await listTables(db),[]);
  } finally {await database.close();await storage?.runtime.dispose();}
});
