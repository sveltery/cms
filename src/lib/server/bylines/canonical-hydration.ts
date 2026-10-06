// Native historical provider5 predates the canonical attribution descriptor9.
// Keep the whole Source hydrators unchanged; only a genuine missing credit table
// on the exact known historical marker layout/prefix retains its old payload.
import {sql} from 'kysely';
import type {CmsDatabase} from '../database/contract.ts';
import {sqliteErrorMessage} from '../database/errors.ts';
import {normalizeMigrationSql} from '../database/migration-provider.ts';
import {hydrateBylines,hydrateBylinesMany} from './content-hydration.ts';
import {bylineDatabase} from './storage.ts';

async function historicalCanonical5(database:CmsDatabase):Promise<boolean> {
 const expected=normalizeMigrationSql('CREATE TABLE _cms_migrations (version INTEGER PRIMARY KEY CHECK(version > 0))');
 const marker=(await sql<{sql:string|null}>`SELECT sql FROM sqlite_master WHERE name='_cms_migrations' AND type='table'`.execute(database.db)).rows[0];
 if(!marker?.sql||normalizeMigrationSql(marker.sql)!==expected)return false;
 // Recheck the marker layout and all ordered markers in the same real snapshot.
 const snapshot=(await sql<{marker_sql:string|null;versions:string}>`SELECT
  (SELECT sql FROM sqlite_master WHERE name='_cms_migrations' AND type='table') AS marker_sql,
  (SELECT json_group_array(version) FROM (SELECT version FROM _cms_migrations ORDER BY version)) AS versions`.execute(database.db)).rows[0];
 if(!snapshot?.marker_sql||normalizeMigrationSql(snapshot.marker_sql)!==expected)return false;
 const versions:unknown=JSON.parse(snapshot.versions);
 return Array.isArray(versions)&&versions.length===5&&versions.every((version,index)=>version===index+1);
}
async function canonicalHydration(database:CmsDatabase,operation:()=>Promise<void>):Promise<void> {
 try {await operation();}
 catch(cause){
  if(!/^no such table: _cms_content_bylines$/.test(sqliteErrorMessage(cause)??'')||!await historicalCanonical5(database))throw cause;
 }
}
export async function hydrateCanonicalBylines(database:CmsDatabase,...args:Parameters<typeof hydrateBylines> extends [unknown,...infer Rest]?Rest:never):Promise<void> {
 await canonicalHydration(database,()=>hydrateBylines(bylineDatabase(database),...args));
}
export async function hydrateCanonicalBylinesMany(database:CmsDatabase,...args:Parameters<typeof hydrateBylinesMany> extends [unknown,...infer Rest]?Rest:never):Promise<void> {
 await canonicalHydration(database,()=>hydrateBylinesMany(bylineDatabase(database),...args));
}
