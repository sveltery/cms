// Retained current per-method handoff regression. Standalone reads are not a
// complete render scope; this remains a known failing contract, with no Source
// callback credit. The coherent public render contract is tested separately.
import { afterEach, expect, it } from 'vitest';
import { openSqlite } from '../../src/lib/server/database/sqlite.ts';
import { migrateCms } from '../../src/lib/server/database/migrations.ts';
import { runWithContext } from '../../src/lib/server/menus/context.ts';
import { createQueryScope } from '../../src/lib/server/query-sdk/scope.ts';
import { primeSeoPanel, peekSeoPanel } from '../../src/lib/server/query-sdk/seo-panel.ts';
import type { CmsDatabase } from '../../src/lib/server/database/contract.ts';

let database: CmsDatabase | undefined;
afterEach(async () => {await database?.close(); database = undefined;});
it('retains the first standalone-method to outer-page cache handoff failure', async () => {
  database = openSqlite(':memory:');
  await migrateCms(database);
  const panel = {title: 'Supplied title', description: null, image: null, canonical: null, noIndex: false};
  await runWithContext({editMode: false}, async () => {
    createQueryScope(database!)(() => primeSeoPanel('post', 'entry-id', panel));
    expect(await peekSeoPanel('post', 'entry-id')).toBe(panel);
  });
});
