import type { Kysely } from 'kysely';
import { sql } from 'kysely';

const tables = [
 '_cms_redirects','_cms_redirect_write_lock','_cms_redirect_state',
 '_cms_redirect_artifacts','_cms_redirect_generation_artifacts','_cms_404_log'
] as const;

export class RedirectSchemaIncompleteError extends Error {
 override readonly name='RedirectSchemaIncompleteError';
}

export async function redirectSchemaPresent<DB>(db:Kysely<DB>):Promise<boolean> {
 const result=await sql<{name:string}>`SELECT name FROM sqlite_master
  WHERE type='table' AND name IN (${sql.join(tables.map(name=>sql`${name}`))})`.execute(db);
 if(result.rows.length===0)return false;
 if(result.rows.length!==tables.length)throw new RedirectSchemaIncompleteError('Redirect storage is partially installed');
 return true;
}
