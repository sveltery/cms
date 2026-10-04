// Whole Original ordinary-installation readiness requirements; zero Source credit.
// Existing read-only product checks run against genuine canonical startup only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateCms } from '../src/lib/server/database/migrations.ts';
import { menuStorageReady } from '../src/lib/server/menus/readiness.ts';
import { requireSectionWidgetStorage } from '../src/lib/server/sections-widgets/readiness.ts';
import { commentsReady } from '../src/lib/server/comments/readiness.ts';
import { redirectSchemaPresent } from '../src/lib/server/redirects/readiness.ts';
import { historicalFeatureStorage } from './helpers/canonical-feature-storage-original.ts';

for (const mode of ['Node', 'raw D1', 'scoped D1'] as const) {
  test(`${mode}: ordinary startup satisfies actual Menu storage readiness`, { timeout: 90_000 }, async () => {
    const fixture = await historicalFeatureStorage(mode, 0);
    try {
      await migrateCms(fixture.database);
      assert.equal(await menuStorageReady(fixture.database), true);
    } finally { await fixture.close(); }
  });
  for (const family of ['sections', 'widgets'] as const) {
    test(`${mode}: ordinary startup satisfies actual ${family} storage readiness`, { timeout: 90_000 }, async () => {
      const fixture = await historicalFeatureStorage(mode, 0);
      try {
        await migrateCms(fixture.database);
        await assert.doesNotReject(() => requireSectionWidgetStorage(fixture.database.db, family));
      } finally { await fixture.close(); }
    });
  }
  test(`${mode}: ordinary startup satisfies actual Comments and runtime-dependency readiness`, { timeout: 90_000 }, async () => {
    const fixture = await historicalFeatureStorage(mode, 0);
    try {
      await migrateCms(fixture.database);
      assert.equal(await commentsReady(fixture.database), true);
    } finally { await fixture.close(); }
  });
  test(`${mode}: ordinary startup satisfies actual Redirect publication storage readiness`, { timeout: 90_000 }, async () => {
    const fixture = await historicalFeatureStorage(mode, 0);
    try {
      await migrateCms(fixture.database);
      assert.equal(await redirectSchemaPresent(fixture.database.db), true);
    } finally { await fixture.close(); }
  });
}
