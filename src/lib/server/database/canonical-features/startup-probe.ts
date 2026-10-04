// Unmapped finite canonical catalogue query. Two JSON bindings preserve the
// complete membership census within raw/scoped D1's100-binding limit.
import { sql } from 'kysely';
import type { CmsDatabase } from '../contract.ts';
export function featureStartupProbe(database: CmsDatabase, names: readonly string[], triggerNames: readonly string[]) {
  return sql<{ name: string; type: string }>`SELECT name,type FROM sqlite_master
    WHERE lower(name) GLOB '_cms_*' OR (type <> 'trigger' AND lower(name) IN
      (SELECT value FROM json_each(${JSON.stringify(names)})))
      OR (type='trigger' AND lower(name) IN
      (SELECT value FROM json_each(${JSON.stringify(triggerNames)})))`.compile(database.db);
}
