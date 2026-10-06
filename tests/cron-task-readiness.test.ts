// Supplemental native capability/schema controls; zero copied Source assertion credit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'kysely';
import { schemaAdminStorage } from './helpers/schema-admin-storage.ts';
import { historicalFeatureStorage } from './helpers/canonical-feature-storage-original.ts';
import { databaseSnapshot } from './helpers/lifecycle-startup.ts';
import { migrateCms } from '../src/lib/server/database/migrations.ts';
import { SchemaRegistry } from '../src/lib/server/database/registry.ts';
import { requireCronTaskStorage } from '../src/lib/server/cron/readiness.ts';
import { cronTaskStorageDescriptor } from '../src/lib/server/cron/storage-provider.ts';

for (const mode of ['Node', 'D1'] as const) {
  test(mode + ': readiness never installs missing storage or grants an unmarked descriptor', async t => {
    const fixture = await schemaAdminStorage(mode); t.after(fixture.close);
    const before = await databaseSnapshot(fixture.database);
    await assert.rejects(requireCronTaskStorage(fixture.database), { code: 'MIGRATION_REQUIRED' });
    assert.deepEqual(await databaseSnapshot(fixture.database), before);
    await fixture.database.atomicBatch(cronTaskStorageDescriptor.statements(fixture.database));
    const unmarked = await databaseSnapshot(fixture.database);
    await assert.rejects(requireCronTaskStorage(fixture.database), { code: 'MIGRATION_REQUIRED' });
    assert.deepEqual(await databaseSnapshot(fixture.database), unmarked);
  });
  test(mode + ': canonical readiness preserves every Source026 nullable field/default and due index', async t => {
    const fixture = await schemaAdminStorage(mode); t.after(fixture.close);
    await migrateCms(fixture.database); await requireCronTaskStorage(fixture.database);
    const columns = (await sql<{ name: string; type: string; notnull: number; dflt_value: string | null; pk: number }>`PRAGMA table_info(_cms_cron_tasks)`.execute(fixture.database.db)).rows;
    assert.deepEqual(columns.map(({ name, type, notnull, dflt_value, pk }) => ({ name, type, notnull, dflt_value, pk })), [
      { name: 'id', type: 'TEXT', notnull: 0, dflt_value: null, pk: 1 },
      { name: 'plugin_id', type: 'TEXT', notnull: 1, dflt_value: null, pk: 0 },
      { name: 'task_name', type: 'TEXT', notnull: 1, dflt_value: null, pk: 0 },
      { name: 'schedule', type: 'TEXT', notnull: 1, dflt_value: null, pk: 0 },
      { name: 'is_oneshot', type: 'INTEGER', notnull: 1, dflt_value: '0', pk: 0 },
      { name: 'data', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
      { name: 'next_run_at', type: 'TEXT', notnull: 1, dflt_value: null, pk: 0 },
      { name: 'last_run_at', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
      { name: 'status', type: 'TEXT', notnull: 1, dflt_value: "'idle'", pk: 0 },
      { name: 'locked_at', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
      { name: 'enabled', type: 'INTEGER', notnull: 1, dflt_value: '1', pk: 0 },
      { name: 'created_at', type: 'TEXT', notnull: 0, dflt_value: "datetime('now')", pk: 0 }
    ]);
    await sql`INSERT INTO _cms_cron_tasks(id,plugin_id,task_name,schedule,next_run_at,created_at) VALUES(NULL,'plugin','nullable','@daily','2030-01-02T03:04:05.000Z',NULL)`.execute(fixture.database.db);
    const row = (await sql<{ id: string | null; is_oneshot: number; enabled: number; status: string; data: string | null; created_at: string | null }>`SELECT id,is_oneshot,enabled,status,data,created_at FROM _cms_cron_tasks`.execute(fixture.database.db)).rows[0];
    assert.deepEqual({ ...row }, { id: null, is_oneshot: 0, enabled: 1, status: 'idle', data: null, created_at: null });
    const due = (await sql<{ name: string }>`PRAGMA index_info(idx_cron_tasks_due)`.execute(fixture.database.db)).rows;
    const plugin = (await sql<{ name: string }>`PRAGMA index_info(idx_cron_tasks_plugin)`.execute(fixture.database.db)).rows;
    assert.deepEqual(due.map(column => column.name), ['enabled', 'status', 'next_run_at']);
    assert.deepEqual(plugin.map(column => column.name), ['plugin_id']);
    const plan = (await sql<{ detail: string }>`EXPLAIN QUERY PLAN SELECT id FROM _cms_cron_tasks WHERE next_run_at <= '2030-01-03T00:00:00.000Z' AND status='idle' AND enabled=1 ORDER BY next_run_at ASC LIMIT 10`.execute(fixture.database.db)).rows;
    assert.ok(plan.some(row => row.detail.includes('idx_cron_tasks_due')));
  });
  test(mode + ': readiness refuses changed index columns and preserves the actual wrong layout', async t => {
    const fixture = await schemaAdminStorage(mode); t.after(fixture.close);
    await migrateCms(fixture.database);
    await sql`DROP INDEX idx_cron_tasks_due`.execute(fixture.database.db);
    await sql`CREATE INDEX idx_cron_tasks_due ON _cms_cron_tasks(status, enabled, next_run_at)`.execute(fixture.database.db);
    const before = await databaseSnapshot(fixture.database);
    await assert.rejects(requireCronTaskStorage(fixture.database), { code: 'MIGRATION_REQUIRED' });
    await assert.rejects(migrateCms(fixture.database), { code: 'MIGRATION_REQUIRED' });
    assert.deepEqual(await databaseSnapshot(fixture.database), before);
  });
  test(mode + ': read-only readiness rejects a future/gapped marker sequence with unchanged storage', async t => {
    const fixture = await schemaAdminStorage(mode); t.after(fixture.close);
    await migrateCms(fixture.database);
    for (const marker of ['future', 'gap'] as const) {
      if (marker === 'future') await sql`INSERT INTO _cms_migrations(version) VALUES(19)`.execute(fixture.database.db);
      else { await sql`DELETE FROM _cms_migrations WHERE version=19 OR version=17`.execute(fixture.database.db); }
      const before = await databaseSnapshot(fixture.database);
      await assert.rejects(requireCronTaskStorage(fixture.database), { code: 'MIGRATION_REQUIRED' });
      assert.deepEqual(await databaseSnapshot(fixture.database), before);
    }
  });
  test(mode + ': creation supports actual18 while future/gapped canonical admission remains refused', async t => {
    const fixture = await schemaAdminStorage(mode); t.after(fixture.close);
    await migrateCms(fixture.database);
    const registry = new SchemaRegistry(fixture.database);
    await assert.doesNotReject(registry.createCollection({ slug: 'cron_owner', label: 'Cron Owner' }));
    await sql`INSERT INTO _cms_migrations(version) VALUES(19)`.execute(fixture.database.db);
    let before = await databaseSnapshot(fixture.database);
    await assert.rejects(registry.createCollection({ slug: 'future', label: 'Future' }), { code: 'MIGRATION_REQUIRED' });
    assert.deepEqual(await databaseSnapshot(fixture.database), before);
    await sql`DELETE FROM _cms_migrations WHERE version=19 OR version=17`.execute(fixture.database.db);
    before = await databaseSnapshot(fixture.database);
    await assert.rejects(registry.createCollection({ slug: 'gap', label: 'Gap' }), { code: 'MIGRATION_REQUIRED' });
    assert.deepEqual(await databaseSnapshot(fixture.database), before);
  });
}
for (const mode of ['Node', 'raw D1', 'scoped D1'] as const) {
  test(mode + ': actual persisted Cron rows and readiness survive canonical reopen/idempotence', { timeout: 90_000 }, async () => {
    const fixture = await historicalFeatureStorage(mode);
    try {
      await migrateCms(fixture.database);
      await sql`INSERT INTO _cms_cron_tasks(id,plugin_id,task_name,schedule,is_oneshot,data,next_run_at,locked_at,status) VALUES('stored','plugin','stored','2030-01-02T03:04:05+02:00',1,'{"preserve":"  literal"}','2030-01-02T01:04:05.000Z','2030-01-02T00:01:00.000Z','running')`.execute(fixture.database.db);
      const before = (await sql<Record<string, unknown>>`SELECT * FROM _cms_cron_tasks`.execute(fixture.database.db)).rows.map(row => ({ ...row }));
      await fixture.reopen(); await migrateCms(fixture.database); await requireCronTaskStorage(fixture.database);
      assert.deepEqual((await sql<Record<string, unknown>>`SELECT * FROM _cms_cron_tasks`.execute(fixture.database.db)).rows.map(row => ({ ...row })), before);
    } finally { await fixture.close(); }
  });
}
