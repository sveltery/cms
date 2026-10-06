// Genuine Source physical fixture; never installs or emulates native storage.
import { describe } from 'vitest';
import { Kysely, SqliteDialect } from 'kysely';
import { openNodeSqliteDatabase } from '../../../src/lib/server/database/node-sqlite-compat.ts';
import type { Database } from '../../../src/lib/server/general-media/upstream/database/types.ts';
import * as initial from '../../../src/lib/server/general-media/upstream/database/migrations/001_initial.ts';
import * as status from '../../../src/lib/server/general-media/upstream/database/migrations/002_media_status.ts';
import * as placeholders from '../../../src/lib/server/general-media/upstream/database/migrations/024_media_placeholders.ts';
import * as attempts from '../../../src/lib/server/general-media/upstream/database/migrations/054_media_upload_attempts.ts';
import * as folders from '../../../src/lib/server/general-media/upstream/database/migrations/072_media_folders.ts';
import * as focal from '../../../src/lib/server/general-media/upstream/database/migrations/073_media_focal_point.ts';
export async function setupTestDatabase(): Promise<Kysely<Database>> {
  const db = new Kysely<Database>({dialect:new SqliteDialect({database:openNodeSqliteDatabase(':memory:')})});
  for (const migration of [initial,status,placeholders,attempts,folders,focal]) await migration.up(db as Kysely<unknown>);
  return db;
}
export async function teardownTestDatabase(db:Kysely<Database>|undefined) { if(db)await db.destroy(); }
export interface DialectTestContext {db:Kysely<Database>;dialect:'sqlite'}
export async function setupForDialect(dialect:'sqlite'):Promise<DialectTestContext> {return {db:await setupTestDatabase(),dialect};}
export async function teardownForDialect(context:DialectTestContext|undefined) {await teardownTestDatabase(context?.db);}
// The original SQLite expansion is real. PostgreSQL has no configured fixture.
export function describeEachDialect(name:string,run:(dialect:'sqlite')=>void) {describe(name+' [genuine Source SQLite]',()=>run('sqlite'));}
