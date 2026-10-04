import { getRequestContext } from './context.ts';
import { withCanonicalFeatureNamespaces } from '../database/canonical-features/namespaces.ts';
export async function getDb() {
  const db = getRequestContext()?.db;
  if (!db) throw new Error('Menu database is unavailable outside a configured request');
  return withCanonicalFeatureNamespaces(db);
}
