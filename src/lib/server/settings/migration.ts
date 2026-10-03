// Native migration provider for pinned OptionsRepository (initial + storage revision migrations).
import {sql} from 'kysely';
import type {CmsDatabase} from '../database/contract.ts';
import {migrationObjects,type CmsMigrationProvider} from '../database/migration-provider.ts';
export function optionsStatements(database:CmsDatabase) {
 return [sql`CREATE TABLE options (name TEXT PRIMARY KEY NOT NULL,value TEXT NOT NULL,revision TEXT NOT NULL)`.compile(database.db)];
}
export const optionsMigration:CmsMigrationProvider={version:6,name:'site-options',
 async statements(database){return optionsStatements(database);},
 async expectedObjects(database){return migrationObjects(optionsStatements(database));}};
