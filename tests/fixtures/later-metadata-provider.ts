// Original later-provider integration fixture; zero source test credit.
// Real proposed metadata8 checkpoint2d34f6 physicalDDL aliased to contiguous6
// after actual lifecycle5; no production6/7 registration or empty providers.
// Fidelity repair for EmDash 1.1.0 migrations 003_schema_registry and 012_search.
// Source pin 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; Copyright 2026 Cloudflare Inc.
// MIT: notices/emdash-MIT.txt. Historical native migrations remain unchanged.
import { sql } from 'kysely';
import type { CmsDatabase } from '../../src/lib/server/database/contract.ts';
import type { CmsMigrationProvider } from '../../src/lib/server/database/migration-provider.ts';
import { schemaMigration } from '../../src/lib/server/database/schema-migrations.ts';

const fieldColumns = ['id','collection_id','slug','label','type','column_type','required','unique',
  'default_value','validation','sort_order','created_at','widget','options','searchable','indexed','translatable'];

export const metadataFidelityMigration: CmsMigrationProvider = {
  version:6, name:'metadata-storage-fidelity',
  async expectedObjects(database) {
    return (await schemaMigration.expectedObjects(database)).map(object => {
      if(object.name==='_cms_fields') return {...object,sql:object.sql.replace('"_cms_collections"(id)','"_cms_collections"(id) ON DELETE CASCADE')};
      if(object.name==='_cms_collections') return {...object,sql:object.sql.replace(/\)\s*$/,', search_config TEXT)')};
      return object;
    });
  },
  async statements(database:CmsDatabase) {
    const descriptors=await this.expectedObjects(database);
    const fields=descriptors.find(object=>object.name==='_cms_fields')!;
    const columns=fieldColumns.map(column=>sql.id(column));
    return [
      sql.raw(fields.sql.replace('"_cms_fields"','"_cms_fields_v8"')).compile(database.db),
      sql`INSERT INTO _cms_fields_v8 (${sql.join(columns)}) SELECT ${sql.join(columns)} FROM _cms_fields`.compile(database.db),
      sql`DROP TABLE _cms_fields`.compile(database.db),
      sql`ALTER TABLE _cms_fields_v8 RENAME TO _cms_fields`.compile(database.db),
      sql`CREATE INDEX idx_cms_fields_collection ON _cms_fields(collection_id, sort_order)`.compile(database.db),
      sql`ALTER TABLE _cms_collections ADD COLUMN search_config TEXT`.compile(database.db)
    ];
  }
};
