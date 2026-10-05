// Derived scalar reads from EmDash 1.1.0, pin 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e.
// Copyright 2026 Cloudflare Inc.; MIT. See notices/emdash-MIT.txt.
import type { Kysely } from 'kysely';
import type { CmsDatabase, CmsTables, Collection } from '../database/contract.ts';
import { SchemaRegistry } from '../database/registry.ts';
import { canonicalSourceDatabase } from '../canonical-storage/namespace.ts';
import type { SiteSettings } from './settings-types.ts';

/** Existing repositories own all storage behavior. These seams only read. */
function readHost(db: Kysely<CmsTables>): CmsDatabase {
  return {
    db,
    async atomicBatch() { throw new Error('SEO read seam cannot write'); },
    async close() { throw new Error('SEO read seam does not own the connection'); }
  };
}

/** Scalar site settings from the actual Options owner. Media resolution is pending. */
export async function getSiteSettingsWithDb(db: Kysely<CmsTables>): Promise<Partial<SiteSettings>> {
  const { OptionsRepository } = await import('../options/repository.ts');
  const options = new OptionsRepository(canonicalSourceDatabase(readHost(db)));
  const allOptions = await options.getByPrefix('site:');
  const settings: Record<string, unknown> = {};
  for (const [key, value] of allOptions) settings[key.replace('site:', '')] = value;
  return settings as Partial<SiteSettings>;
}

/** Explicit database read, matching the Source seam's use of its Registry owner. */
export function getCollectionInfoWithDb(db: Kysely<CmsTables>, slug: string): Promise<Collection | null> {
  return new SchemaRegistry(readHost(db)).getCollection(slug);
}
