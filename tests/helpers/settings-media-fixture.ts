import type {Kysely} from 'kysely';
import {settingsDb} from '../../src/lib/server/settings/index.ts';
import type {SettingsTables} from '../../src/lib/server/settings/tables.ts';
import {setupForDialect,teardownForDialect,type DialectTestContext} from './media-source-database.ts';

// Selected source settings callbacks use real canonical schema and adapters.
// No MCP server, PAT, plugin or deployed runtime is supplied by this fixture.
let dialect:'sqlite'|'d1'='sqlite';
const fixtures:DialectTestContext[]=[];
export function selectSettingsMediaDialect(value:'sqlite'|'d1'){dialect=value;}
export async function setupTestDatabase(){
 const context=await setupForDialect(dialect);fixtures.push(context);
 settingsDb(context.database,context.db as unknown as Kysely<SettingsTables>);
 return context.db;
}
export async function closeSettingsMediaDatabases(){
 while(fixtures.length)await teardownForDialect(fixtures.pop()!);
}
