// Derived Native domain controls for the original setup route's two catch stages.
// The complete Original route/test authorities and their clocks remain unchanged.
import { expect, it, vi } from 'vitest';
import { schemaAdminStorage } from '../helpers/schema-admin-storage.ts';
import { migrateCms } from '../../src/lib/server/database/migrations.ts';
import { seedSourceDatabase } from '../../src/lib/server/seed/namespace.ts';
import { applySetupSeedWithinBudget } from '../../src/lib/server/seed/index.ts';

const fixture = vi.hoisted(() => ({ loadError: undefined as unknown }));
vi.mock('virtual:emdash/seed', () => ({
  get seed() {
    if (fixture.loadError !== undefined) throw fixture.loadError;
    return { version: '1', collections: [{ slug: 'posts', label: 'Posts', fields: [] }] };
  },
  userSeed: null,
}));

for (const target of ['Node', 'D1'] as const) {
  it(`${target}: identifies only the actual apply failure and preserves its exact cause`, async () => {
    const storage = await schemaAdminStorage(target);
    try {
      await migrateCms(storage.database);
      fixture.loadError = undefined;
      const failure = new Error('actual setup caller query failure');
      let reads = 0;
      const db = seedSourceDatabase(storage.database).withPlugin({
        transformQuery({ node }) {
          if (node.kind === 'SelectQueryNode') { reads++; throw failure; }
          return node;
        },
        async transformResult({ result }) { return result; },
      });
      let actual: unknown;
      try { await applySetupSeedWithinBudget(db, { title: 'Actual Site' }); }
      catch (error) { actual = error; }
      expect(reads).toBeGreaterThan(0);
      expect(actual).toMatchObject({ name: 'SetupSeedApplyError', cause: failure });
      expect(Reflect.get(actual as object, 'cause')).toBe(failure);
    } finally { await storage.close(); }
  }, 30000);

  it(`${target}: leaves the real seed-load error outside the application stage`, async () => {
    const storage = await schemaAdminStorage(target);
    try {
      await migrateCms(storage.database);
      const failure = new Error('actual virtual seed accessor failure');
      fixture.loadError = failure;
      let reads = 0;
      const db = seedSourceDatabase(storage.database).withPlugin({
        transformQuery({ node }) { reads++; return node; },
        async transformResult({ result }) { return result; },
      });
      let actual: unknown;
      try { await applySetupSeedWithinBudget(db, { title: 'Actual Site' }); }
      catch (error) { actual = error; }
      expect(actual).toBe(failure);
      expect(reads).toBe(0);
    } finally { fixture.loadError = undefined; await storage.close(); }
  }, 30000);
}
