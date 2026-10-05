import { afterEach, expect, it } from 'vitest';
import { openSqlite } from '../../src/lib/server/database/sqlite.ts';
import { migrateCms } from '../../src/lib/server/database/migrations.ts';
import { SchemaRegistry } from '../../src/lib/server/database/registry.ts';
import { bindQueryDatabase } from '../../src/lib/server/query-sdk/bindings.ts';
import { createQueryScope } from '../../src/lib/server/query-sdk/scope.ts';
import { getLiveEntry } from '../../src/lib/server/query-sdk/live-provider.ts';
import { LiveEntryNotFoundError } from '../../parity/astro-7.3.2/content-errors-authority/dist/content/loaders/errors.js';
import type { CmsDatabase } from '../../src/lib/server/database/contract.ts';

let database: CmsDatabase | undefined;
afterEach(async () => {await database?.close(); database = undefined;});

it('returns the genuine Astro missing-entry constructor for an absent Native loader entry', async () => {
  database = openSqlite(':memory:');
  await migrateCms(database);
  bindQueryDatabase(database);
  await new SchemaRegistry(database).createCollection({slug: 'post', label: 'Posts', labelSingular: 'Post'});
  const filter = {type: 'post', id: 'missing'};
  const result = await createQueryScope(database)(() => getLiveEntry('_emdash', filter));
  expect(result.entry).toBeUndefined();
  expect(result.error).toBeInstanceOf(LiveEntryNotFoundError);
  expect(result.error?.name).toBe('LiveEntryNotFoundError');
  expect((result.error as LiveEntryNotFoundError).collection).toBe('_emdash');
  expect(result.error?.message).toBe('Entry _emdash → {"type":"post","id":"missing"} was not found.');
});
