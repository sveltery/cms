import { sql } from 'kysely';
import type { CmsDatabase } from '../database/contract.ts';
import { taxonomyMigration } from '../database/taxonomy-migrations.ts';

/** Readonly exact provider-object census; no migrations or retained database. */
export async function taxonomyStorageReady(database: CmsDatabase): Promise<boolean> {
  try {
    const expected = await taxonomyMigration.expectedObjects(database);
    const result = await sql<{name:string;type:string;sql:string|null}>`SELECT name,type,sql FROM sqlite_master
      WHERE name IN (${sql.join(expected.map(object=>object.name))}) OR tbl_name IN
      ('_cms_taxonomies','_cms_content_taxonomies','_cms_taxonomy_defs','_cms_taxonomy_def_groups')`.execute(database.db);
    const owned=result.rows.filter(row=>row.sql!==null);
    return owned.length===expected.length && expected.every(object=>owned.some(row=>row.name===object.name && row.type===object.type && row.sql===object.sql));
  } catch { return false; }
}
