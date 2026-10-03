// Native persistent-options prerequisite; supplemental, zero copied-source credit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'kysely';
import { openSqlite } from '../src/lib/server/database/sqlite.ts';
import { migrateCms } from '../src/lib/server/database/migrations.ts';
test('canonical migration installs persistent versioned options without provisioning settings', async()=>{
 const database=openSqlite(':memory:');
 try {await migrateCms(database);await migrateCms(database);
 const tables=(await sql<{name:string}>`SELECT name FROM sqlite_master WHERE type='table'`.execute(database.db)).rows;
 assert.ok(tables.some(table=>table.name==='options'),'canonical persistent options table');
 const columns=(await sql<{name:string}>`PRAGMA table_info(options)`.execute(database.db)).rows.map(row=>row.name);
 assert.deepEqual(columns,['name','value','revision']);
 assert.deepEqual((await sql`SELECT * FROM options`.execute(database.db)).rows,[]);
 }finally{await database.close();}
});
