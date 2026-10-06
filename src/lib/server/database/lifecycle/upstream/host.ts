import type { Kysely, RawBuilder, QueryResult } from 'kysely';
import type { ContentItem } from './database/repositories/types.ts';
import type { CmsDatabase } from '../../contract.ts';

export interface LifecycleDependencies {
  after?: (task: () => void | Promise<void>) => void;
  timezone?: () => Promise<string | undefined>;
}
/** Trusted native publication transport; omitted callers retain Source execution. */
export type PublicationStatementExecutor = (statement: RawBuilder<unknown>, existing: ContentItem,
  intendedSlug: string | null, intendedPublishedAt: string) => Promise<QueryResult<unknown>>;
const databases = new WeakMap<object, CmsDatabase>();
const dependencies = new WeakMap<object, LifecycleDependencies>();
export function registerLifecycleDatabase(database: CmsDatabase, values: LifecycleDependencies = {}) {
  databases.set(database.db, database); dependencies.set(database.db, values);
}
export const lifecycleDatabase = (db: object) => databases.get(db);
/** Read the trusted host callbacks without replacing the registered owner metadata. */
export const lifecycleDependencies = (db: object): Readonly<LifecycleDependencies> | undefined => dependencies.get(db);
/** The caller has already qualified the genuine owner-backed view/transaction. */
export function inheritLifecycleDatabase(database: CmsDatabase, sourceDb: object): void {
  if (!databases.has(sourceDb)) throw new Error('Lifecycle inheritance requires the actual registered source owner');
  const values = dependencies.get(sourceDb)!;
  databases.set(database.db, database);
  dependencies.set(database.db, values);
}
export async function siteTimezone(db: Kysely<any>): Promise<{value: string} | undefined> {
  const configured = dependencies.get(db)?.timezone;
  const timezone = configured ? await configured() : undefined;
  return timezone === undefined ? undefined : {value:JSON.stringify(timezone)};
}
export function invalidateCollectionCache(_collection: string) {
  // The pinned default has no configured object cache. This host currently
  // exposes that default only; configured cache support is a separate provider.
}
