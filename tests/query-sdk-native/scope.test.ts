import { afterEach, describe, expect, it } from 'vitest';
import { sql } from 'kysely';
import { openSqlite } from '../../src/lib/server/database/sqlite.ts';
import { migrateCms, CMS_MIGRATION_VERSION } from '../../src/lib/server/database/migrations.ts';
import { runWithContext, getRequestContext, type RequestContext } from '../../src/lib/server/menus/context.ts';
import { requestCached } from '../../src/lib/server/menus/request-cache.ts';
import { createQueryScope } from '../../src/lib/server/query-sdk/scope.ts';
import type { CmsDatabase } from '../../src/lib/server/database/contract.ts';

const databases: CmsDatabase[] = [];
async function database() {
  const value = openSqlite(':memory:');
  await migrateCms(value);
  databases.push(value);
  return value;
}
afterEach(async () => {await Promise.all(databases.splice(0).map(value => value.close()));});

describe('Native query constructor request scope', () => {
  it('retains one request-cache identity for the bound database across SDK calls', async () => {
    const value = await database();
    const scope = createQueryScope(value);
    let actualReads = 0;
    const read = () => scope(() => requestCached('native-sdk-installation-version', async () => {
      actualReads++;
      return (await sql<{version: number}>`SELECT MAX(version) AS version FROM _cms_migrations`.execute(value.db)).rows[0]?.version;
    }));
    await runWithContext({editMode: false}, async () => {
      const firstContext = scope(getRequestContext);
      expect(await read()).toBe(CMS_MIGRATION_VERSION);
      expect(await read()).toBe(CMS_MIGRATION_VERSION);
      expect(actualReads).toBe(1);
      expect(scope(getRequestContext)).toBe(firstContext);
    });
  });

  it('keeps separate request contexts and databases out of one another’s caches', async () => {
    const first = await database();
    const second = await database();
    const firstScope = createQueryScope(first);
    const secondScope = createQueryScope(second);
    const outer = {editMode: false};
    await runWithContext(outer, async () => {
      expect(firstScope(getRequestContext)?.db).toBe(first.db);
      expect(secondScope(getRequestContext)?.db).toBe(second.db);
      expect(firstScope(getRequestContext)).not.toBe(secondScope(getRequestContext));
      expect(getRequestContext()).toBe(outer);
      expect(getRequestContext()?.db).toBeUndefined();
    });
    const earlier = await runWithContext({editMode: false}, async () => firstScope(getRequestContext));
    const later = await runWithContext({editMode: false}, async () => firstScope(getRequestContext));
    expect(earlier).not.toBe(later);
  });

  it('preserves the original trusted database override, locale, preview and lifetime hook', async () => {
    const bound = await database();
    const isolated = await database();
    const scope = createQueryScope(bound);
    const keepAlive = (_task: Promise<void>) => {};
    const original = {editMode: true, db: isolated.db as unknown as RequestContext['db'], dbIsIsolated: true,
      locale: 'fr', preview: {collection: 'post', id: 'existing-row'}, keepAlive};
    await runWithContext(original, async () => {
      expect(scope(getRequestContext)).toBe(original);
      expect(scope(getRequestContext)?.db).toBe(isolated.db);
      expect(scope(getRequestContext)?.locale).toBe('fr');
      expect(scope(getRequestContext)?.preview).toBe(original.preview);
      expect(scope(getRequestContext)?.keepAlive).toBe(keepAlive);
    });
  });
});
