import { afterEach, describe, expect, it } from 'vitest';
import { sql } from 'kysely';
import type { RequestEvent } from '@sveltejs/kit';
import { openSqlite } from '../../src/lib/server/database/sqlite.ts';
import { migrateCms } from '../../src/lib/server/database/migrations.ts';
import { runWithContext, getRequestContext, type RequestContext } from '../../src/lib/server/menus/context.ts';
import { requestCached } from '../../src/lib/server/menus/request-cache.ts';
import { primeSeoPanel, peekSeoPanel } from '../../src/lib/server/query-sdk/seo-panel.ts';
import { getDb } from '../../src/lib/server/query-sdk/loader.ts';
import { withQueryRenderRequest } from '../../src/lib/server/query-sdk/render-context.ts';
import type { CmsDatabase } from '../../src/lib/server/database/contract.ts';

const databases: CmsDatabase[] = [];
async function database() {
  const value = openSqlite(':memory:'); await migrateCms(value); databases.push(value); return value;
}
afterEach(async () => {await Promise.all(databases.splice(0).map(value => value.close()));});
function event(database: CmsDatabase, keepAlive?: (task: Promise<void>) => void): Pick<RequestEvent, 'locals'> {
  return {locals: {cms: {database, principal: null, mutationsEnabled: false, keepAlive}}};
}
const suppliedPanel = {title: 'Supplied panel', description: null, image: null, canonical: null, noIndex: false};

describe('actual Native public-render query context', () => {
  it('spans async database reads and downstream original request-cache consumers', async () => {
    const value = await database();
    const original = {editMode: false, locale: 'fr'};
    let actualReads = 0;
    await runWithContext(original, async () => {
      await withQueryRenderRequest(event(value), async () => {
        const context = getRequestContext();
        expect(context?.db).toBe(value.db);
        expect(context?.locale).toBe('fr');
        const read = () => requestCached('render-version', async () => {
          actualReads++;
          return (await sql<{version: number}>`SELECT MAX(version) AS version FROM _cms_migrations`.execute(await getDb())).rows[0]?.version;
        });
        expect(await read()).toBe(15);
        primeSeoPanel('post', 'entry-id', suppliedPanel);
        await Promise.resolve();
        expect(getRequestContext()).toBe(context);
        expect(await peekSeoPanel('post', 'entry-id')).toBe(suppliedPanel);
        expect(await read()).toBe(15);
        expect(actualReads).toBe(1);
      });
      expect(getRequestContext()).toBe(original);
      expect(getRequestContext()?.db).toBeUndefined();
      expect(await peekSeoPanel('post', 'entry-id')).toBeNull();
    });
  });

  it('keeps the explicit trusted context and asynchronous lifetime hook intact', async () => {
    const bound = await database();
    const isolated = await database();
    const keepAlive = (_task: Promise<void>) => {};
    const original: RequestContext = {editMode: true, locale: 'fr',
      db: isolated.db as unknown as RequestContext['db'], dbIsIsolated: true,
      preview: {collection: 'post', id: 'entry-id'}, keepAlive};
    await runWithContext(original, async () => {
      await withQueryRenderRequest(event(bound, () => {}), async () => {
        await Promise.resolve();
        expect(getRequestContext()).toBe(original);
        expect(getRequestContext()?.db).toBe(isolated.db);
        expect(getRequestContext()?.locale).toBe('fr');
        expect(getRequestContext()?.editMode).toBe(true);
        expect(getRequestContext()?.preview).toBe(original.preview);
        expect(getRequestContext()?.keepAlive).toBe(keepAlive);
      });
      expect(getRequestContext()).toBe(original);
    });
  });

  it('restores the caller context after asynchronous render failure', async () => {
    const value = await database();
    const original = {editMode: false};
    const failure = new Error('controlled render failure');
    await runWithContext(original, async () => {
      await expect(withQueryRenderRequest(event(value), async () => {
        await Promise.resolve();
        expect(getRequestContext()?.db).toBe(value.db);
        primeSeoPanel('post', 'entry-id', suppliedPanel);
        throw failure;
      })).rejects.toBe(failure);
      expect(getRequestContext()).toBe(original);
      expect(await peekSeoPanel('post', 'entry-id')).toBeNull();
    });
  });

  it('keeps unconfigured renders in their original context', async () => {
    const original = {editMode: false, locale: 'en'};
    await runWithContext(original, async () => {
      const result = await withQueryRenderRequest({locals: {}}, async () => {
        await Promise.resolve(); return getRequestContext();
      });
      expect(result).toBe(original);
    });
  });
});
