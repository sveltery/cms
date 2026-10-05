import type { Kysely } from 'kysely';
import type { CmsDatabase } from '../database/contract.ts';
import { lifecycleDatabase } from '../database/lifecycle/upstream/host.ts';
import { SchemaRegistry as NativeRegistry } from '../database/registry.ts';
import { OptionsRepository as NativeOptions } from '../options/repository.ts';
import { canonicalSourceDatabase } from '../canonical-storage/namespace.ts';

/** Consume the already-owned trusted connection; never open another database. */
export function schedulingStorage(db: Kysely<any>): CmsDatabase {
  const database = lifecycleDatabase(db);
  if (!database) throw new Error('Scheduled publishing requires registered CMS storage');
  return database;
}

export class SchemaRegistry extends NativeRegistry {
  constructor(db: Kysely<any>) { super(schedulingStorage(db)); }
}

export class OptionsRepository extends NativeOptions {
  constructor(db: Kysely<any>) { super(canonicalSourceDatabase(schedulingStorage(db))); }
}
