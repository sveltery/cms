// Native storage requirements. Whole pinned Source migrations/tests are separate.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'kysely';
import { schemaAdminStorage } from './helpers/schema-admin-storage.ts';
import { installHistorical17 } from './helpers/cron-storage/historical17.ts';
import { databaseSnapshot } from './helpers/lifecycle-startup.ts';
import { migrateCms, CMS_MIGRATIONS } from '../src/lib/server/database/migrations.ts';
const latest = Array.from({ length: 18 }, (_, index) => index + 1);
for (const mode of ['Node', 'D1'] as const) {
  test(mode + ': ordinary fresh startup installs the complete canonical Cron domain', async t => {
    const fixture = await schemaAdminStorage(mode); t.after(fixture.close);
    await migrateCms(fixture.database);
    const names = (await sql<{ name: string }>`SELECT name FROM sqlite_master WHERE name='_cms_cron_tasks'`.execute(fixture.database.db)).rows;
    assert.deepEqual(names.map(row => row.name), ['_cms_cron_tasks']);
    assert.deepEqual((await fixture.database.db.selectFrom('_cms_migrations').select('version').orderBy('version').execute()).map(row => row.version), latest);
  });
  test(mode + ': actual contiguous public1–17 upgrades preserve every existing object and row', async t => {
    const fixture = await schemaAdminStorage(mode); t.after(fixture.close);
    await installHistorical17(fixture.database);
    await sql`INSERT INTO _cms_options(name,value) VALUES('cron-upgrade-preserved','{"marker":17}')`.execute(fixture.database.db);
    const before = await databaseSnapshot(fixture.database);
    await migrateCms(fixture.database);
    const markers = await fixture.database.db.selectFrom('_cms_migrations').select('version').orderBy('version').execute();
    assert.deepEqual(markers.map(row => row.version), latest);
    const after = await databaseSnapshot(fixture.database);
    for (const object of before.objects) assert.deepEqual(after.objects.find(candidate => candidate.name === object.name && candidate.type === object.type), object);
    for (const table of before.tables.filter(table => table.name !== '_cms_migrations')) assert.deepEqual(after.tables.find(candidate => candidate.name === table.name), table);
  });
  test(mode + ': future Cron collision is rejected before any startup write', async t => {
    const fixture = await schemaAdminStorage(mode); t.after(fixture.close);
    await installHistorical17(fixture.database);
    await sql`CREATE TABLE _cms_cron_tasks(operator_value TEXT)`.execute(fixture.database.db);
    const before = await databaseSnapshot(fixture.database); let batches = 0;
    await assert.rejects(migrateCms({ ...fixture.database, async atomicBatch(statements) { batches++; return fixture.database.atomicBatch(statements); } }), { code: 'MIGRATION_REQUIRED' });
    assert.equal(batches, 0);
    assert.deepEqual(await databaseSnapshot(fixture.database), before);
  });
  test(mode + ': late real Cron uniqueness failure rolls back the complete fresh startup', async t => {
    const fixture = await schemaAdminStorage(mode); t.after(fixture.close);
    const before = await databaseSnapshot(fixture.database);
    await assert.rejects(migrateCms({ ...fixture.database, async atomicBatch(statements) {
      assert.ok(statements.some(statement => /create table "_cms_cron_tasks"/i.test(statement.sql)));
      return fixture.database.atomicBatch([...statements,
        sql`INSERT INTO _cms_cron_tasks(id,plugin_id,task_name,schedule,next_run_at) VALUES('one','plugin','same','@daily','2030-01-02T03:04:05.000Z'),('two','plugin','same','@daily','2030-01-02T03:04:05.000Z')`.compile(fixture.database.db)]);
    } }), /UNIQUE constraint failed/);
    assert.deepEqual(await databaseSnapshot(fixture.database), before);
  });
}
test('provider18 is a new named provider after the frozen contiguous1–17 registry', () => {
  assert.deepEqual(CMS_MIGRATIONS.map(provider => provider.version), latest);
  assert.equal(CMS_MIGRATIONS.at(-1)?.name, 'cron-task-storage');
});
