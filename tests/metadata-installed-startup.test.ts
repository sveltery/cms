import test from 'node:test';
import assert from 'node:assert/strict';
import {sql} from 'kysely';
import {schemaAdminStorage} from './helpers/schema-admin-storage.ts';
import {migrateCms} from '../src/lib/server/database/migrations.ts';
import {lifecycleMigration} from '../src/lib/server/database/lifecycle-migrations.ts';

// Original canonical provider integration. Real providers6/7/8 are registered;
// no manufactured marker, manually authored metadata DDL or fake provider.
for(const target of ['Node','D1'] as const) {
  test(`${target}: valid installed provider8 metadata is accepted on ordinary restart`,async()=>{
    const storage=await schemaAdminStorage(target);
    try {
      await migrateCms(storage.database);
      await assert.doesNotReject(()=>migrateCms(storage.database));
    } finally {await storage.close();}
  });
  test(`${target}: malformed final metadata is rejected before lifecycle dynamic descriptor reads`,async()=>{
    const storage=await schemaAdminStorage(target);
    const original=lifecycleMigration.expectedObjects; let dynamicReads=0;
    try {
      await migrateCms(storage.database);
      await sql`ALTER TABLE _cms_fields ADD COLUMN unexpected TEXT`.execute(storage.database.db);
      lifecycleMigration.expectedObjects=async function(database,version) {
        if((version ?? 0)>=5) dynamicReads++;
        return original.call(this,database,version);
      };
      await assert.rejects(()=>migrateCms(storage.database),{code:'MIGRATION_REQUIRED'});
      assert.equal(dynamicReads,0);
    } finally {lifecycleMigration.expectedObjects=original;await storage.close();}
  });
}
