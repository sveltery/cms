import { afterEach, expect, it, vi } from 'vitest';
import { openSqlite } from '../../../src/lib/server/database/sqlite.ts';
import { migrateCms } from '../../../src/lib/server/database/migrations.ts';
import { requireCronTaskStorage } from '../../../src/lib/server/cron/readiness.ts';
import { createConfiguredPluginRuntime, runWithPluginDatabase, type CmsPluginRuntime } from '../../../src/lib/server/plugins/runtime.ts';
import type { CmsDatabase } from '../../../src/lib/server/database/contract.ts';
const owners: CmsDatabase[] = []; const runtimes: CmsPluginRuntime[] = [];
afterEach(async () => { vi.unstubAllEnvs(); for (const runtime of runtimes.splice(0)) await runtime.shutdown(); for (const database of owners.splice(0)) await database.close(); });
async function owner() { const database = openSqlite(':memory:'); owners.push(database); await migrateCms(database); await requireCronTaskStorage(database); return database; }

it('executes an actual canonical context schedule through the same runtime hook pipeline', async () => {
  vi.stubEnv('DEV', false);
  const database = await owner(); const invoked: unknown[] = [];
  const runtime = await createConfiguredPluginRuntime({ database, now: () => new Date('2030-01-03T00:00:00.000Z'), plugins: [{
    id: 'reminders', version: '1.0.0', hooks: { cron: async (event, context) => { invoked.push({ event, pluginId: context.plugin.id }); } }
  }] }); runtimes.push(runtime);
  await runtime.createContext('reminders').cron!.schedule('once', { schedule: '2030-01-02T03:04:05+02:00', data: { value: 'controlled' } });
  expect(await database.db.selectFrom('_cms_cron_tasks').select(['plugin_id', 'task_name', 'next_run_at']).execute()).toEqual([
    { plugin_id: 'reminders', task_name: 'once', next_run_at: '2030-01-02T01:04:05.000Z' }
  ]);
  expect(await runtime.cronExecutor.tick()).toBe(1);
  expect(invoked).toEqual([{ event: { name: 'once', data: { value: 'controlled' }, scheduledAt: '2030-01-02T01:04:05.000Z' }, pluginId: 'reminders' }]);
  expect(await runtime.createContext('reminders').cron!.list()).toEqual([]);
});

it('resolves schedules and ticks against each actual event owner', async () => {
  vi.stubEnv('DEV', false);
  const fallback = await owner(); const event = await owner(); const invoked: string[] = [];
  const runtime = await createConfiguredPluginRuntime({ database: fallback, now: () => new Date('2030-01-03T00:00:00.000Z'), plugins: [{
    id: 'scoped', version: '1.0.0', hooks: { cron: async (_task, context) => { invoked.push(await context.kv.get<string>('owner') ?? 'missing'); } }
  }] }); runtimes.push(runtime);
  await runWithPluginDatabase(event, async () => {
    const context = runtime.createContext('scoped'); await context.kv.set('owner', 'event');
    await context.cron!.schedule('scoped-once', { schedule: '2030-01-02T00:00:00.000Z' });
    expect(await runtime.cronExecutor.tick()).toBe(1);
  });
  expect(invoked).toEqual(['event']);
  expect(await fallback.db.selectFrom('_cms_cron_tasks').selectAll().execute()).toEqual([]);
  expect(await runtime.cronExecutor.tick()).toBe(0);
});
