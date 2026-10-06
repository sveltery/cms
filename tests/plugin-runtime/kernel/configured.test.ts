import { afterEach, describe, expect, it } from 'vitest';
import { openSqlite } from '../../../src/lib/server/database/sqlite.ts';
import { migrateCms } from '../../../src/lib/server/database/migrations.ts';
import { createConfiguredPluginRuntime, runWithPluginDatabase, type CmsPluginRuntime } from '../../../src/lib/server/plugins/runtime.ts';
import { pluginSourceDatabase } from '../../../src/lib/server/plugins/database.ts';
import { PluginStateRepository } from '../../../src/lib/server/plugins/state.ts';
import type { CmsDatabase } from '../../../src/lib/server/database/contract.ts';
const databases: CmsDatabase[] = []; const runtimes: CmsPluginRuntime[] = [];
afterEach(async () => { for (const runtime of runtimes.splice(0)) await runtime.shutdown(); for (const database of databases.splice(0)) await database.close(); });
async function database() { const value = openSqlite(':memory:'); databases.push(value); await migrateCms(value); return value; }
async function runtime(owner: CmsDatabase, plugins: Parameters<typeof createConfiguredPluginRuntime>[0]['plugins']) {
 const value = await createConfiguredPluginRuntime({ database: owner, plugins }); runtimes.push(value); return value;
}
describe('configured Native plugin kernel with actual canonical state and options', () => {
 it('implicitly enables absent state without install hooks or state writes and respects real inactive rows', async () => {
  const owner = await database(); const calls: string[] = [];
  const plugins = [{ id: 'configured', version: '1.0.0', hooks: {
   'plugin:install': async () => { calls.push('install'); }, 'plugin:activate': async () => { calls.push('activate'); }
  } }];
  const active = await runtime(owner, plugins);
  expect(active.manager.hasPlugin('configured')).toBe(true); expect(active.manager.isActive('configured')).toBe(true);
  expect(calls).toEqual([]); expect(await owner.db.selectFrom('_cms_plugin_state').selectAll().execute()).toEqual([]);
  await new PluginStateRepository(pluginSourceDatabase(owner)).disable('configured', '1.0.0');
  expect((await runtime(owner, plugins)).manager.isActive('configured')).toBe(false);
 });
 it('retains deactivate access through cleanup and rebuilds the real hook pipeline on each transition', async () => {
  const owner = await database(); const calls: string[] = [];
  const value = await runtime(owner, [{ id: 'configured', version: '1.0.0', hooks: {
   'plugin:activate': async (_event, ctx) => { await ctx.kv.set('active', true); calls.push('activate'); },
   'plugin:deactivate': async (_event, ctx) => { await ctx.kv.set('cleanup', true); calls.push('deactivate'); }
  } }]);
  await value.setPluginStatus('configured', 'inactive');
  expect(value.manager.isActive('configured')).toBe(false);
  expect(value.hooks.hasHooks('plugin:activate')).toBe(false);
  expect(value.hooks.hasHooks('plugin:deactivate')).toBe(false);
  await value.setPluginStatus('configured', 'active'); expect(value.manager.isActive('configured')).toBe(true);
  expect(await value.createContext('configured').kv.get('cleanup')).toBe(true); expect(calls).toEqual(['deactivate', 'activate']);
 });
 it('resolves each context against the actual current event owner instead of the configured fallback', async () => {
  const first = await database(); const second = await database();
  const value = await runtime(first, [{ id: 'configured', version: '1.0.0' }]);
  await value.createContext('configured').kv.set('owner', 'first');
  await runWithPluginDatabase(second, async () => {
   await value.createContext('configured').kv.set('owner', 'second');
   expect(await value.createContext('configured').kv.get('owner')).toBe('second');
  });
  expect(await value.createContext('configured').kv.get('owner')).toBe('first');
  expect(await first.db.selectFrom('_cms_options').selectAll().where('name', '=', 'plugin:configured:owner').execute()).toHaveLength(1);
  expect(await second.db.selectFrom('_cms_options').selectAll().where('name', '=', 'plugin:configured:owner').execute()).toHaveLength(1);
 });
});
