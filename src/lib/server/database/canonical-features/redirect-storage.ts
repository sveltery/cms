// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// Final physical SQLite DDL from the unchanged whole public Source migrations.
// No source callback is replaced or registered by this unmapped descriptor.
import { sql, type CompiledQuery } from 'kysely';
import type { CmsDatabase } from '../contract.ts';
import type { FeatureStorageObject } from './descriptors.ts';
import physical from './redirect-physical-schema.json' with { type: 'json' };

export const redirectStorageDescriptor = {
  version: 14,
  name: 'redirect-storage',
  expectedObjects(): readonly FeatureStorageObject[] {
    return physical.objects.map(object => ({ ...object, type: object.type as FeatureStorageObject['type'] }));
  },
  async statements(database: CmsDatabase): Promise<readonly CompiledQuery[]> {
    const schema = this.expectedObjects();
    return [...['table', 'index', 'trigger'].flatMap(type => schema.filter(object => object.type === type)
      .map(object => sql.raw(object.sql).compile(database.db))),
    // Exact ordinary Source081/091 initialization, not synthetic success rows.
    sql`INSERT INTO _cms_redirect_write_lock (id,token,expires_at,generation) VALUES (1,'',0,0)
      ON CONFLICT(id) DO NOTHING`.compile(database.db),
    sql`INSERT INTO _cms_redirect_state (id,revision,generation,generation_revision,repair_expires_at)
      VALUES (1,0,NULL,-1,0) ON CONFLICT(id) DO NOTHING`.compile(database.db)];
  }
};
