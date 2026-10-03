import type { Kysely } from 'kysely';
import { up as base } from '../../../src/lib/server/redirects/migrations/029_redirects.ts';
import { up as bounded404 } from '../../../src/lib/server/redirects/migrations/035_bounded_404_log.ts';
import { up as guards } from '../../../src/lib/server/redirects/migrations/081_redirect_write_guards.ts';
import { installRedirectTables } from '../../../src/lib/server/redirects/migrations/index.ts';

export function runMigrations(db:Kysely<unknown>):Promise<void> { return installRedirectTables(db); }
export function createMigrator(db:Kysely<unknown>,_options?:{migrationTableSchema?:string}) {
 return {async migrateTo(name:string) {
  if(name!=='089_auto_seed_completion')throw new Error('This native fixture supports only the complete redirect state before Source090.');
  await base(db);await bounded404(db);await guards(db);
  return {error:undefined};
 }};
}
