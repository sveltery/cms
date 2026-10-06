// Supplemental Native caller controls for the complete pinned setup route's
// outer load catch and inner apply catch. No Original callback/body credit.
import { afterEach, expect, it, vi } from 'vitest';
import { openSqlite } from '../src/lib/server/database/sqlite.ts';
import { migrateCms } from '../src/lib/server/database/migrations.ts';
import { seedSourceDatabase } from '../src/lib/server/seed/namespace.ts';
import { InvalidCursorError } from '../src/lib/server/comments/upstream/database/repositories/types.ts';
import { applySetupSite } from '../src/lib/server/setup/site.ts';

const fixture = vi.hoisted(() => ({ loadError: undefined as unknown }));
vi.mock('virtual:emdash/seed', () => ({
  get seed() {
    if (fixture.loadError !== undefined) throw fixture.loadError;
    return { version: '1', collections: [{ slug: 'posts', label: 'Posts', fields: [] }] };
  },
  userSeed: null,
}));
afterEach(() => { fixture.loadError = undefined; });

async function callSetup(failure?: unknown) {
  const database = openSqlite(':memory:');
  try {
    await migrateCms(database);
    let selects = 0;
    const seedDb = seedSourceDatabase(database).withPlugin({
      transformQuery({ node }) {
        if (node.kind === 'SelectQueryNode') {
          selects++;
          if (failure !== undefined) throw failure;
        }
        return node;
      },
      async transformResult({ result }) { return result; },
    });
    const url = new URL('https://cms.test/api/setup');
    const response = await applySetupSite({ database, seedDb, url,
      configuredOrigin: url.origin, development: false, workers: false,
      request: new Request(url, { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'Actual Site', includeContent: false }) }),
    });
    return { response, body: await response.json(), selects };
  } finally { await database.close(); }
}

it('real virtual seed load failures use the original outer SETUP_ERROR boundary', async () => {
  fixture.loadError = new Error('actual seed accessor failure');
  const actual = await callSetup();
  expect(actual.selects).toBe(1); // Only the real setup-completion guard ran.
  expect(actual.response.status).toBe(500);
  expect(actual.body.error).toEqual({ code: 'SETUP_ERROR', message: 'Setup failed' });
});

it('actual application errors preserve their original class and 400 response', async () => {
  const failure = new InvalidCursorError('actual invalid cursor');
  const actual = await callSetup(failure);
  expect(actual.selects).toBeGreaterThan(1); // Guard failure is allowed; real apply is then reached.
  expect(actual.response.status).toBe(400);
  expect(actual.body.error).toEqual({ code: 'INVALID_CURSOR', message: failure.message });
});

it('actual ordinary application failures use the original inner SEED_ERROR boundary', async () => {
  const actual = await callSetup(new Error('actual caller query failure'));
  expect(actual.selects).toBeGreaterThan(1);
  expect(actual.response.status).toBe(500);
  expect(actual.body.error).toEqual({ code: 'SEED_ERROR', message: 'Failed to apply seed' });
});
