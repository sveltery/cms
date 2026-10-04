// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// Derived physical DDL from complete EmDash1.1.0 migration authorities at
// immutable913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; see Source inventory.
import { sql, type CompiledQuery } from 'kysely';
import type { CmsDatabase } from '../contract.ts';
import physical from './physical-schema.json' with { type: 'json' };

export interface FeatureStorageObject {
  readonly name: string;
  readonly type: 'table' | 'index' | 'trigger';
  readonly sql: string;
}

function objects(group: 'mediaAttribution' | 'directedRelations'): readonly FeatureStorageObject[] {
  return physical[group].objects.map(object => ({
    name: object.name, type: object.type as FeatureStorageObject['type'], sql: object.sql
  }));
}

function statements(database: CmsDatabase, group: 'mediaAttribution' | 'directedRelations'): CompiledQuery[] {
  // Finite static pinned-source DDL; no caller-provided identifier or SQL.
  // Parents precede children. Indexes/triggers are installed after all tables.
  const schema = objects(group);
  const tablePriority = ['_cms_media_folders', '_cms_media', '_cms_bylines', '_cms_byline_fields'];
  const tables = schema.filter(object => object.type === 'table').toSorted((left, right) => {
    const rank = (name: string) => {
      const position = tablePriority.indexOf(name);
      return position < 0 ? tablePriority.length : position;
    };
    return rank(left.name) - rank(right.name) || left.name.localeCompare(right.name, 'en');
  });
  return [...tables, ...schema.filter(object => object.type === 'index'),
    ...schema.filter(object => object.type === 'trigger')].map(object => sql.raw(object.sql).compile(database.db));
}

/** Unregistered owned descriptor. Actual canonical registration is a separate reviewed integration. */
export const mediaAttributionStorageDescriptor = {
  version: 9,
  name: 'media-and-attribution-storage',
  expectedObjects(): readonly FeatureStorageObject[] { return objects('mediaAttribution'); },
  async statements(database: CmsDatabase): Promise<readonly CompiledQuery[]> {
    return [...statements(database, 'mediaAttribution'),
      sql`INSERT INTO _cms_options(name,value) VALUES ('byline_fields_version','0')
        ON CONFLICT(name) DO NOTHING`.compile(database.db),
      sql`INSERT INTO _cms_media_usage_activation(task_key,state) VALUES ('incremental_capture','expanded')
        ON CONFLICT(task_key) DO NOTHING`.compile(database.db)];
  }
};

/** Static final Source043→086 storage only. Source087 atomic backfill is still a prerequisite to registration. */
export const directedRelationStorageObjects = {
  expectedObjects(): readonly FeatureStorageObject[] { return objects('directedRelations'); },
  statements(database: CmsDatabase): readonly CompiledQuery[] { return statements(database, 'directedRelations'); }
};
