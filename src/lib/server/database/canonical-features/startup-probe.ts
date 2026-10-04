// Unmapped finite canonical catalogue query, extracted from registration-r1.
import { sql } from 'kysely';
import type { CmsDatabase } from '../contract.ts';
export function featureStartupProbe(database: CmsDatabase, names: readonly string[], triggerNames: readonly string[]) {
  return sql<{ name: string; type: string }>`SELECT name,type FROM sqlite_master
    WHERE lower(name) GLOB '_cms_*' OR (type <> 'trigger' AND lower(name) IN (${sql.join(names)}))
      OR (type='trigger' AND lower(name) IN (${sql.join(triggerNames)}))`.compile(database.db);
}
