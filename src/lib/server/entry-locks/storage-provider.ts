// Source075 complete six-column layout, immutable EmDash1.1.0 pin913cb1bb9b7f08c3ff0d258b4420e53835b6a58e.
// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
import type { CompiledQuery } from 'kysely';
import type { CmsDatabase } from '../database/contract.ts';
import { migrationObjects, type CmsMigrationProvider } from '../database/migration-provider.ts';

function statements(database:CmsDatabase):readonly CompiledQuery[] {
  const db=database.db;
  return [
    db.schema.createTable('_cms_entry_locks')
      .addColumn('collection','text',column=>column.notNull())
      .addColumn('entry_id','text',column=>column.notNull())
      .addColumn('user_id','text',column=>column.notNull().references('_cms_auth_users.id').onDelete('cascade'))
      .addColumn('token','text',column=>column.notNull())
      .addColumn('acquired_at','text',column=>column.notNull())
      .addColumn('expires_at','text',column=>column.notNull())
      .addPrimaryKeyConstraint('pk_cms_entry_locks',['collection','entry_id']).compile(),
    db.schema.createIndex('idx_cms_entry_locks_user_id').on('_cms_entry_locks').column('user_id').compile()
  ];
}

/** Static ownership only. Ordinary startup rejects an unknown pre-existing table before writes.
 * The native forward provider therefore omits Source IF NOT EXISTS adoption. Existing provider8
 * already owns Source075's edit_locking column; its schema and statements remain unchanged.
 */
export const entryLockStorageDescriptor=Object.freeze({
  name:'entry-edit-lock-storage',table:'_cms_entry_locks' as const,statements,
  expectedObjects(database:CmsDatabase){return migrationObjects(statements(database));}
});
/** Sole forward provider19; all accepted providers1–18 stay immutable. */
export const entryLockStorageMigration:CmsMigrationProvider={
  version:19,name:entryLockStorageDescriptor.name,
  async statements(database){return entryLockStorageDescriptor.statements(database);},
  async expectedObjects(database){return entryLockStorageDescriptor.expectedObjects(database);}
};
