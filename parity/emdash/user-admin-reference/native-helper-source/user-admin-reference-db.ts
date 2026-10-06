// Existing qualified genuine Source schema fixture, separate from Native startup.
// No signed/session/token probes: only stored user/profile administration.
import {Kysely,SqliteDialect} from 'kysely';
import {openNodeSqliteDatabase} from '../../src/lib/server/database/node-sqlite-compat.ts';
import {up as initial} from '../../parity/emdash/user-admin-reference/runtime/packages/core/src/database/migrations/001_initial.mjs';
import {up as auth} from '../../parity/emdash/user-admin-reference/runtime/packages/core/src/database/migrations/008_auth.mjs';
import {up as disabled} from '../../parity/emdash/user-admin-reference/runtime/packages/core/src/database/migrations/009_user_disabled.mjs';
import {up as apiTokens} from '../../parity/emdash/user-admin-reference/runtime/packages/core/src/database/migrations/016_api_tokens.mjs';
import {up as algorithm} from '../../parity/emdash/user-admin-reference/runtime/packages/core/src/database/migrations/037_credential_algorithm.mjs';
export async function setupTestDatabase(){
 const db=new Kysely<any>({dialect:new SqliteDialect({database:openNodeSqliteDatabase(':memory:')})});
 try{for(const migration of [initial,auth,disabled,apiTokens,algorithm])await migration(db);return db;}
 catch(cause){await db.destroy();throw cause;}
}
export async function teardownTestDatabase(db:Kysely<any>){await db.destroy();}
