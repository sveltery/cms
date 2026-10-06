// Supplemental Native metadata composition controls. Actual empty account
// authority is only read; no HTTP, credential, session or account action occurs.
import { afterEach, expect, it, vi } from 'vitest';
import { openSqlite } from '../src/lib/server/database/sqlite.ts';
import { migrateCms } from '../src/lib/server/database/migrations.ts';
import { OptionsRepository } from '../src/lib/server/comments/upstream/database/repositories/options.ts';
import { seedSourceDatabase } from '../src/lib/server/seed/namespace.ts';
import { runtimeSetupStatus } from '../src/lib/server/setup/status.ts';
import type { SeedFile } from '../src/lib/server/seed/types.ts';

const fixture = vi.hoisted(() => ({ userSeed: null as SeedFile | null }));
vi.mock('virtual:emdash/seed', () => ({ seed: null, get userSeed() { return fixture.userSeed; } }));
afterEach(() => { fixture.userSeed = null; });

async function emptyAccountStatus(before?: (database: ReturnType<typeof openSqlite>) => Promise<void>) {
  const database = openSqlite(':memory:');
  try {
    await migrateCms(database);
    await before?.(database);
    const status = await runtimeSetupStatus({ database, publicOrigin: 'https://cms.test', basePath: '', rpName: 'Actual Site' });
    const accountSetup = await database.db.selectFrom('_cms_auth_setup').selectAll().execute();
    return { status, accountSetup };
  } finally { await database.close(); }
}

it('actual user seed metadata reaches the same runtime status consumed by the wizard', async () => {
  fixture.userSeed = { version: '1', meta: { name: 'Actual Template', description: 'Actual description' },
    settings: { title: 'Actual Title', tagline: 'Actual Tagline' },
    collections: [{ slug: 'posts', label: 'Posts', fields: [] }],
    content: { posts: [] } };
  const actual = await emptyAccountStatus();
  expect(actual.status).toEqual({ needsSetup: true, step: 'start', authMode: 'passkey', seedInfo: {
    name: 'Actual Template', description: 'Actual description', collections: 1, hasContent: true,
    title: 'Actual Title', tagline: 'Actual Tagline',
  } });
  expect(actual.accountSetup).toEqual([]);
});

it('without an actual user seed the genuine empty-account status retains null metadata', async () => {
  const actual = await emptyAccountStatus();
  expect(actual.status).toEqual({ needsSetup: true, step: 'start', authMode: 'passkey', seedInfo: null });
  expect(actual.accountSetup).toEqual([]);
});

it('canonical site_complete metadata retains the Source start-step behavior without writing account state', async () => {
  const actual = await emptyAccountStatus(async database => {
    await new OptionsRepository(seedSourceDatabase(database)).set('emdash:setup_state', { step: 'site_complete', title: 'Actual Site' });
  });
  expect(actual.status).toEqual({ needsSetup: true, step: 'start', authMode: 'passkey', seedInfo: null });
  expect(actual.accountSetup).toEqual([]);
});
