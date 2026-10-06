// Native requirements derived from complete Source075 and its repository family.
// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
import { test, expect } from 'vitest';
import { sql } from 'kysely';
import { openSqlite } from '../../src/lib/server/database/sqlite.ts';
import { migrateCms } from '../../src/lib/server/database/migrations.ts';
import type { CmsDatabase } from '../../src/lib/server/database/contract.ts';

async function fixture() {
  const database = openSqlite(':memory:');
  await migrateCms(database);
  await database.atomicBatch([
    sql`INSERT INTO _cms_auth_users (id,role,disabled) VALUES ('ada',40,0),('linus',40,0)`.compile(database.db)
  ]);
  return database;
}
async function claim(database: CmsDatabase, user: string, token: string, takeover = false) {
  return sql<{user_id:string;token:string;acquired_at:string;expires_at:string}>`
    INSERT INTO _cms_entry_locks (collection,entry_id,user_id,token,acquired_at,expires_at)
    VALUES ('posts','entry',${user},${token},strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now','+420 seconds'))
    ON CONFLICT(collection,entry_id) DO UPDATE SET
      user_id=excluded.user_id, token=excluded.token,
      acquired_at=CASE WHEN _cms_entry_locks.user_id=excluded.user_id THEN _cms_entry_locks.acquired_at ELSE excluded.acquired_at END,
      expires_at=excluded.expires_at
    WHERE ${takeover} OR _cms_entry_locks.user_id=excluded.user_id OR _cms_entry_locks.expires_at<=strftime('%Y-%m-%dT%H:%M:%fZ','now')
    RETURNING user_id,token,acquired_at,expires_at`.execute(database.db);
}

test('normal canonical startup admits a free lease using the database clock', async () => {
  const database=await fixture();
  try {
    let result:Awaited<ReturnType<typeof claim>>|undefined;
    await expect((async()=>{result=await claim(database,'ada','tab-1');})()).resolves.toBeUndefined();
    expect(result!.rows).toHaveLength(1);
    expect(result!.rows[0].expires_at>result!.rows[0].acquired_at).toBe(true);
  } finally {await database.close();}
});
test('the composite key refuses another live holder without takeover', async () => {
  const database=await fixture();
  try {
    await claim(database,'ada','tab-1');
    expect((await claim(database,'linus','tab-2')).rows).toHaveLength(0);
    expect((await sql<{user_id:string}>`SELECT user_id FROM _cms_entry_locks`.execute(database.db)).rows).toEqual([{user_id:'ada'}]);
  } finally {await database.close();}
});
test('explicit takeover changes the actual persisted holder', async () => {
  const database=await fixture();
  try {await claim(database,'ada','tab-1');expect((await claim(database,'linus','tab-2',true)).rows[0].user_id).toBe('linus');}
  finally {await database.close();}
});
test('refreshing the same account preserves acquisition and changes the latest tab token', async () => {
  const database=await fixture();
  try {const first=(await claim(database,'ada','tab-1')).rows[0];const second=(await claim(database,'ada','tab-2')).rows[0];
    expect(second.acquired_at).toBe(first.acquired_at);expect(second.token).toBe('tab-2');}
  finally {await database.close();}
});
test('a stale tab cannot release the latest editing session', async () => {
  const database=await fixture();
  try {await claim(database,'ada','tab-1');await claim(database,'ada','tab-2');
    await sql`DELETE FROM _cms_entry_locks WHERE user_id='ada' AND token='tab-1'`.execute(database.db);
    expect((await sql`SELECT * FROM _cms_entry_locks`.execute(database.db)).rows).toHaveLength(1);}
  finally {await database.close();}
});
test('an expired stored lease can be acquired by the next account', async () => {
  const database=await fixture();
  try {await claim(database,'ada','tab-1');await sql`UPDATE _cms_entry_locks SET expires_at='2020-01-01T00:00:00.000Z'`.execute(database.db);
    expect((await claim(database,'linus','tab-2')).rows[0].user_id).toBe('linus');}
  finally {await database.close();}
});
test('deleting the canonical identity cascades its editing lease', async () => {
  const database=await fixture();
  try {await claim(database,'ada','tab-1');await sql`DELETE FROM _cms_auth_users WHERE id='ada'`.execute(database.db);
    expect((await sql`SELECT * FROM _cms_entry_locks`.execute(database.db)).rows).toHaveLength(0);}
  finally {await database.close();}
});
test('a missing canonical identity cannot acquire an orphan lease', async () => {
  const database=await fixture();
  try {await expect(claim(database,'absent','tab')).rejects.toThrow('FOREIGN KEY constraint failed');}
  finally {await database.close();}
});
test('normal canonical reopen retains a live holder', async () => {
  const database=await fixture();
  try {await claim(database,'ada','tab-1');await migrateCms(database);
    expect((await sql<{user_id:string}>`SELECT user_id FROM _cms_entry_locks`.execute(database.db)).rows).toEqual([{user_id:'ada'}]);}
  finally {await database.close();}
});
