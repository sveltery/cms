import { expect, it } from 'vitest';
import { sql } from 'kysely';
import { schemaAdminStorage } from '../helpers/schema-admin-storage.ts';
import { migrateCms } from '../../src/lib/server/database/migrations.ts';
import { seedSourceDatabase } from '../../src/lib/server/seed/namespace.ts';
import { originalD1FixtureHandle, originalFixtureGuardedHandle } from '../helpers/full-seed/source-d1-fixture-handle.ts';

it('keeps the actual production D1 boundary while isolated Original SQL uses the same real owner', async () => {
  const storage = await schemaAdminStorage('D1');
  try {
    await migrateCms(storage.database);
    const guarded = seedSourceDatabase(storage.database);
    expect(() => originalFixtureGuardedHandle({} as never)).toThrow('actual registered guarded handle');
    await expect(sql`INSERT INTO _cms_guards(token,pass) VALUES ('not-executed',1)`.execute(guarded)).rejects.toThrow('D1 taxonomy writes require atomic adaptation');
    await expect(guarded.insertInto('_emdash_relations').values({id:'not-executed'} as never).execute()).rejects.toThrow('D1 taxonomy writes require atomic adaptation');
    const fixture = originalD1FixtureHandle(guarded,storage.database);
    expect(originalFixtureGuardedHandle(fixture)).toBe(guarded);
    await sql`CREATE TABLE ec_original_fixture(id TEXT PRIMARY KEY,value TEXT)`.execute(fixture);
    await sql`INSERT INTO ec_original_fixture(id,value) VALUES ('real-row','real-value')`.execute(fixture);
    expect((await sql`SELECT id,value FROM ec_original_fixture`.execute(fixture)).rows).toEqual([{id:'real-row',value:'real-value'}]);
    expect((await sql`SELECT id,value FROM ec_original_fixture`.execute(storage.database.db)).rows).toEqual([{id:'real-row',value:'real-value'}]);
    await expect(fixture.transaction().execute(async () => null)).rejects.toThrow('D1 callback transactions are unsupported');
  } finally { await storage.close(); }
},30000);
