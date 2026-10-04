// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// EmDash 1.1.0 Source001/004/022/023/038/053/077, pin 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e.
import { sql, type CompiledQuery } from 'kysely';
import type { CmsDatabase } from './contract.ts';
import { migrationObjects, type CmsMigrationProvider } from './migration-provider.ts';

export interface MigrationTrigger { name: string; type: 'trigger'; sql: string }
export interface TriggerMigration extends CmsMigrationProvider {
  expectedTriggers(database: CmsDatabase): Promise<readonly MigrationTrigger[]>;
}

function optionStatements(database: CmsDatabase): CompiledQuery[] {
  const db = database.db;
  return [
    sql`CREATE TABLE _cms_options (name TEXT PRIMARY KEY, value TEXT NOT NULL,
      revision TEXT NOT NULL DEFAULT '0')`.compile(db),
    sql`CREATE TABLE _cms_plugin_storage (
      plugin_id TEXT NOT NULL, collection TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      revision TEXT NOT NULL DEFAULT '0', PRIMARY KEY(plugin_id, collection, id)
    )`.compile(db),
    sql`CREATE INDEX idx_cms_plugin_storage_list ON _cms_plugin_storage(plugin_id, collection, created_at)`.compile(db),
    sql`CREATE TABLE _cms_plugin_state (
      plugin_id TEXT PRIMARY KEY, version TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'installed',
      installed_at TEXT DEFAULT CURRENT_TIMESTAMP, activated_at TEXT, deactivated_at TEXT, data TEXT,
      source TEXT NOT NULL DEFAULT 'config', marketplace_version TEXT, display_name TEXT, description TEXT,
      registry_publisher_did TEXT, registry_slug TEXT, mcp_tools_enabled INTEGER NOT NULL DEFAULT 0,
      mcp_tools_consent TEXT
    )`.compile(db),
    sql`CREATE INDEX idx_cms_plugin_state_source ON _cms_plugin_state(source) WHERE source = 'marketplace'`.compile(db),
    sql`CREATE INDEX idx_cms_plugin_state_registry ON _cms_plugin_state(source) WHERE source = 'registry'`.compile(db),
    sql`CREATE TABLE _cms_plugin_indexes (
      plugin_id TEXT NOT NULL, collection TEXT NOT NULL, index_name TEXT NOT NULL, fields TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(plugin_id, collection, index_name)
    )`.compile(db)
  ];
}

function revisionStatements(database: CmsDatabase): CompiledQuery[] {
  return [{ table: '_cms_options', keys: ['name'] },
    { table: '_cms_plugin_storage', keys: ['plugin_id', 'collection', 'id'] }].flatMap(store => {
    const rowKey = sql.join(store.keys.map(key => sql`${sql.id(key)} = ${sql.ref('NEW.' + key)}`), sql` AND `);
    return [
      sql`CREATE TRIGGER ${sql.id(store.table + '_revision_insert')}
        AFTER INSERT ON ${sql.id(store.table)} WHEN NEW.revision = '0'
        BEGIN UPDATE ${sql.id(store.table)} SET revision = lower(hex(randomblob(16)))
          WHERE ${rowKey} AND revision = NEW.revision; END`.compile(database.db),
      sql`CREATE TRIGGER ${sql.id(store.table + '_revision_update')}
        AFTER UPDATE ON ${sql.id(store.table)} WHEN NEW.revision = '0' OR NEW.revision = OLD.revision
        BEGIN UPDATE ${sql.id(store.table)} SET revision = lower(hex(randomblob(16)))
          WHERE ${rowKey} AND revision = NEW.revision; END`.compile(database.db)
    ];
  });
}

/** Real fresh storage, registered only after Root qualifies the shared registry. */
export const optionsMigration: TriggerMigration = {
  version: 6, name: 'site-options',
  async statements(database) { return [...optionStatements(database), ...revisionStatements(database)]; },
  async expectedObjects(database) { return migrationObjects(optionStatements(database)); },
  async expectedTriggers(database) {
    return revisionStatements(database).map(statement => ({
      name: /^CREATE TRIGGER "([^"]+)"/.exec(statement.sql)![1], type: 'trigger', sql: statement.sql
    }));
  }
};
