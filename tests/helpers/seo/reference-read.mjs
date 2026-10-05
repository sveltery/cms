// TEST ONLY: use genuine existing Source Registry and actual physical options table.
import { SchemaRegistry } from '../../../parity/emdash/taxonomies/source/packages/core/src/schema/registry.ts';
import { OptionsRepository } from '../../../src/lib/server/options/repository.ts';
export const getCollectionInfoWithDb = (db, slug) => new SchemaRegistry(db).getCollection(slug);
export async function getSiteSettingsWithDb(db) {
  const values = await new OptionsRepository(db).getByPrefix('site:');
  return Object.fromEntries([...values].map(([key, value]) => [key.replace('site:', ''), value]));
}
