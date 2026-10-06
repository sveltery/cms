// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// Source026 exact SQLite layout, hosted by the sole canonical native startup.
// Source088 has no pre-existing rows at legitimate canonical1–17 upgrades.
import { sql, type CompiledQuery } from 'kysely';
import type { CmsDatabase } from '../database/contract.ts';
import { migrationObjects, type CmsMigrationProvider } from '../database/migration-provider.ts';

function statements(database: CmsDatabase): readonly CompiledQuery[] {
  const db = database.db;
  return [
    db.schema.createTable('_cms_cron_tasks')
      .addColumn('id', 'text', column => column.primaryKey())
      .addColumn('plugin_id', 'text', column => column.notNull())
      .addColumn('task_name', 'text', column => column.notNull())
      .addColumn('schedule', 'text', column => column.notNull())
      .addColumn('is_oneshot', 'integer', column => column.notNull().defaultTo(0))
      .addColumn('data', 'text')
      .addColumn('next_run_at', 'text', column => column.notNull())
      .addColumn('last_run_at', 'text')
      .addColumn('status', 'text', column => column.notNull().defaultTo('idle'))
      .addColumn('locked_at', 'text')
      .addColumn('enabled', 'integer', column => column.notNull().defaultTo(1))
      .addColumn('created_at', 'text', column => column.defaultTo(sql`(datetime('now'))`))
      .addUniqueConstraint('uq_cron_tasks_plugin_task', ['plugin_id', 'task_name']).compile(),
    db.schema.createIndex('idx_cron_tasks_due').on('_cms_cron_tasks').columns(['enabled', 'status', 'next_run_at']).compile(),
    db.schema.createIndex('idx_cron_tasks_plugin').on('_cms_cron_tasks').column('plugin_id').compile()
  ];
}

/** Finite named Source026 descriptor; calling it never installs or repairs storage. */
export const cronTaskStorageDescriptor = Object.freeze({
  name: 'cron-task-storage',
  table: '_cms_cron_tasks' as const,
  statements,
  expectedObjects(database: CmsDatabase) { return migrationObjects(statements(database)); }
});
/** Forward-only provider18. Providers1–17 and their recognition remain frozen. */
export const cronTaskStorageMigration: CmsMigrationProvider = {
  version: 18, name: cronTaskStorageDescriptor.name,
  async statements(database) { return cronTaskStorageDescriptor.statements(database); },
  async expectedObjects(database) { return cronTaskStorageDescriptor.expectedObjects(database); }
};
