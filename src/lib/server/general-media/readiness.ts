import { sql } from 'kysely';
import type { CmsDatabase } from '../database/contract.ts';
import { mediaAttributionStorageDescriptor } from '../database/canonical-features/descriptors.ts';
import { normalizeFeatureStorageSql } from '../database/canonical-features/sql-recognition.ts';
/** Read-only check of the actual published media objects; never migrate a request. */
export async function mediaStorageReady(database:CmsDatabase):Promise<boolean> {
  const expected=mediaAttributionStorageDescriptor.expectedObjects().filter(object=>object.name.includes('media'));
  try{
    const {rows}=await sql<{name:string;type:string;sql:string|null}>`SELECT name,type,sql FROM sqlite_master WHERE name IN (${sql.join(expected.map(object=>object.name))})`.execute(database.db);
    return rows.length===expected.length&&expected.every(object=>rows.some(row=>row.name===object.name&&row.type===object.type&&row.sql!==null&&normalizeFeatureStorageSql(row.sql)===normalizeFeatureStorageSql(object.sql)));
  }catch{return false;}
}
