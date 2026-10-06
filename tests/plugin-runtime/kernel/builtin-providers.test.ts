import { afterEach, expect, it, vi } from 'vitest';
import { openSqlite } from '../../../src/lib/server/database/sqlite.ts';
import { migrateCms } from '../../../src/lib/server/database/migrations.ts';
import { createConfiguredPluginRuntime, type CmsPluginRuntime } from '../../../src/lib/server/plugins/runtime.ts';
import { DEFAULT_COMMENT_MODERATOR_PLUGIN_ID } from '../../../src/lib/server/comments/upstream/comments/moderator.ts';
import { DEV_CONSOLE_EMAIL_PLUGIN_ID, getDevEmails, clearDevEmails } from '../../../src/lib/server/plugins/email-console.ts';
import type { CmsDatabase } from '../../../src/lib/server/database/contract.ts';
const owners: CmsDatabase[] = []; const runtimes: CmsPluginRuntime[] = [];
afterEach(async () => { vi.unstubAllEnvs(); vi.restoreAllMocks(); clearDevEmails(); for (const runtime of runtimes.splice(0)) await runtime.shutdown(); for (const owner of owners.splice(0)) await owner.close(); });
async function create(plugins: Parameters<typeof createConfiguredPluginRuntime>[0]['plugins'] = []) {
  const database = openSqlite(':memory:'); owners.push(database); await migrateCms(database);
  const runtime = await createConfiguredPluginRuntime({ database, plugins }); runtimes.push(runtime);
  return { database, runtime };
}
it('uses the complete default comment moderator without persisting its fallback selection', async () => {
  vi.stubEnv('DEV', false);
  const { database, runtime } = await create();
  const result = await runtime.hooks.invokeExclusiveHook('comment:moderate', {
    comment: { authorUserId: null },
    collectionSettings: { commentsAutoApproveUsers: false, commentsModeration: 'first_time' },
    priorApprovedCount: 1
  });
  expect(result?.pluginId).toBe(DEFAULT_COMMENT_MODERATOR_PLUGIN_ID);
  expect(result?.result).toEqual({ status: 'approved', reason: 'Returning commenter' });
  expect(await database.db.selectFrom('_cms_options').selectAll().where('name', '=', 'emdash:exclusive_hook:comment:moderate').execute()).toEqual([]);
});
it('delivers through the complete console provider only in actual development mode', async () => {
  vi.stubEnv('DEV', true); vi.spyOn(console, 'log').mockImplementation(() => {}); clearDevEmails();
  const { runtime } = await create();
  const message = { to: 'controlled@example.test', subject: 'Controlled delivery', text: 'Fixture body' };
  await expect(runtime.email.send(message, 'fixture')).resolves.toBeUndefined();
  expect(runtime.hooks.getExclusiveSelection('email:deliver')).toBe(DEV_CONSOLE_EMAIL_PLUGIN_ID);
  expect(getDevEmails().map(({ message, source }) => ({ message, source }))).toEqual([{ message, source: 'fixture' }]);
});
it('selects a genuine configured moderator over the default and restores fallback when disabled', async () => {
  vi.stubEnv('DEV', false);
  const moderate = vi.fn(async () => ({ status: 'pending', reason: 'Configured review' }));
  const { runtime } = await create([{ id: 'moderator', version: '1.0.0', capabilities: ['users:read'], hooks: { 'comment:moderate': { exclusive: true, handler: moderate } } }]);
  expect(runtime.hooks.getExclusiveSelection('comment:moderate')).toBe('moderator');
  await runtime.setPluginStatus('moderator', 'inactive');
  expect(runtime.hooks.getExclusiveSelection('comment:moderate')).toBe(DEFAULT_COMMENT_MODERATOR_PLUGIN_ID);
  expect(moderate).not.toHaveBeenCalled();
});
