import { afterEach, beforeEach, expect, it } from 'vitest';
import { SchemaRegistry, setupTestDatabase, teardownTestDatabase, handleContentCreate, handleContentList } from '../helpers/content-picker/source-host.ts';
import type { CmsDatabase } from '../../src/lib/server/database/contract.ts';
let db: CmsDatabase['db'];
beforeEach(async () => {
  db = await setupTestDatabase(); const registry = new SchemaRegistry(db);
  await registry.createCollection({ slug: 'people', label: 'People', labelSingular: 'Person', routable: false });
  await registry.createField('people', { slug: 'full_name', label: 'Full name', type: 'string' });
  await registry.updateCollection('people', { titleField: 'full_name' });
  for (const locale of ['en', 'fr']) await handleContentCreate(db, 'people', { locale, slug: `person-${locale}`, data: { full_name: `${locale} Searchable Person` } });
});
afterEach(async () => { await teardownTestDatabase(db); });
it('actual new picker query accepts Source q and returns stored display data', async () => {
  const result = await handleContentList(db, 'people', { q: 'Searchable', limit: 50 });
  expect(result.success).toBe(true);
  if (!result.success) throw new Error('List failed');
  expect(result.data.items.map((item: any) => item.data.full_name)).toEqual(expect.arrayContaining(['en Searchable Person', 'fr Searchable Person']));
});
it('omitted locale returns both persisted variants for menu selection', async () => {
  const result = await handleContentList(db, 'people', { limit: 50 });
  expect(result.success).toBe(true);
  if (!result.success) throw new Error('List failed');
  expect(result.data.items.map((item: any) => item.locale).sort()).toEqual(['en', 'fr']);
});
it('explicit locale limits the actual picker query without changing menu defaults', async () => {
  const result = await handleContentList(db, 'people', { locale: 'fr', limit: 50 });
  expect(result.success).toBe(true);
  if (!result.success) throw new Error('List failed');
  expect(result.data.items.map((item: any) => item.locale)).toEqual(['fr']);
});
