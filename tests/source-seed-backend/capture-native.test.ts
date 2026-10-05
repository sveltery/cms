import { expect, it } from 'vitest';
import { sql } from 'kysely';
import { schemaAdminStorage } from '../helpers/schema-admin-storage.ts';
import { migrateCms } from '../../src/lib/server/database/migrations.ts';
import { SchemaRegistry } from '../../src/lib/server/database/registry.ts';
import { activateMediaUsageCapture } from '../../src/lib/server/blocks/upstream/media/usage/activation.ts';
import { verifyMediaUsageCaptureTriggers } from '../../src/lib/server/blocks/upstream/media/usage/capture-triggers.ts';
import type { Database } from '../../src/lib/server/blocks/upstream/database/types.ts';
import type { Kysely } from 'kysely';

// Supplemental Native transport contracts; no copied Source callback/body credit.
for (const target of ['Node', 'D1'] as const) {
  it(`${target}: publishes a new captured collection with exact durable triggers`, async () => {
    const storage = await schemaAdminStorage(target);
    try {
      await migrateCms(storage.database);
      const db = storage.database.db;
      await activateMediaUsageCapture(db as unknown as Kysely<Database>, { writersDrained: true });
      const registry = new SchemaRegistry(storage.database);
      const error = await registry.createCollection({ slug: 'captured', label: 'Captured' }).then(() => null, error => error);
      expect(error).toBeNull();
      const collection = (await registry.getCollection('captured'))!;
      const identity = { collectionId: collection.id, collectionSlug: collection.slug };
      expect(await verifyMediaUsageCaptureTriggers(db as unknown as Kysely<Database>, identity)).toBe(true);
      expect((await db.selectFrom('_cms_media_usage_index_status').select('capture_state').where('scope_key', '=', 'captured').executeTakeFirst())?.capture_state).toBe('active');
      await sql`INSERT INTO ec_captured(id) VALUES ('actual-captured-row')`.execute(db);
      expect((await db.selectFrom('_cms_media_usage_work').select(['collection_id', 'content_id', 'work_version']).execute())).toEqual([
        { collection_id: collection.id, content_id: 'actual-captured-row', work_version: 1 }
      ]);
    } finally { await storage.close(); }
  }, 30000);

  it(`${target}: captures a whole 74-field seed schema before content writes`, async () => {
    const storage = await schemaAdminStorage(target);
    try {
      await migrateCms(storage.database);
      const db = storage.database.db;
      await activateMediaUsageCapture(db as unknown as Kysely<Database>, { writersDrained: true });
      const registry = new SchemaRegistry(storage.database);
      const fields = Array.from({ length: 74 }, (_, index) => ({ slug: `field_${index}`, label: `Field ${index}`, type: 'string' }));
      const error = await registry.createSeedCollectionSchema({ slug: 'captured_seed', label: 'Captured Seed' }, fields).then(() => null, error => error);
      expect(error).toBeNull();
      const collection = (await registry.getCollectionWithFields('captured_seed'))!;
      expect(collection.fields).toHaveLength(74);
      expect(await verifyMediaUsageCaptureTriggers(db as unknown as Kysely<Database>, { collectionId: collection.id, collectionSlug: collection.slug })).toBe(true);
      await sql`INSERT INTO ec_captured_seed(id,field_73) VALUES ('actual-final-field','stored last field')`.execute(db);
      expect((await sql<{ field_73: string }>`SELECT field_73 FROM ec_captured_seed`.execute(db)).rows).toEqual([{ field_73: 'stored last field' }]);
      expect((await db.selectFrom('_cms_media_usage_work').select('content_id').execute())).toEqual([{ content_id: 'actual-final-field' }]);
    } finally { await storage.close(); }
  }, 30000);

  it(`${target}: rolls back capture and DDL when collection publication fails`, async () => {
    const storage = await schemaAdminStorage(target);
    try {
      await migrateCms(storage.database);
      const db = storage.database.db;
      await activateMediaUsageCapture(db as unknown as Kysely<Database>, { writersDrained: true });
      await sql`CREATE TRIGGER controlled_capture_failure BEFORE INSERT ON _cms_collections WHEN NEW.slug = 'failed_capture' BEGIN SELECT RAISE(ABORT, 'controlled capture publication failure'); END`.execute(db);
      await expect(new SchemaRegistry(storage.database).createCollection({ slug: 'failed_capture', label: 'Failed Capture' })).rejects.toThrow('controlled capture publication failure');
      expect(await db.selectFrom('_cms_collections').select('id').where('slug', '=', 'failed_capture').execute()).toEqual([]);
      expect(await db.selectFrom('_cms_media_usage_index_status').select('scope_key').where('scope_key', '=', 'failed_capture').execute()).toEqual([]);
      expect((await sql`SELECT name FROM sqlite_master WHERE name = 'ec_failed_capture' OR tbl_name = 'ec_failed_capture'`.execute(db)).rows).toEqual([]);
    } finally { await storage.close(); }
  }, 30000);

  it(`${target}: gives seed collections the existing canonical byline and standard indexes`, async () => {
    const storage = await schemaAdminStorage(target);
    try {
      await migrateCms(storage.database);
      await new SchemaRegistry(storage.database).createSeedCollectionSchema({ slug: 'seed_indexes', label: 'Seed Indexes' }, []);
      const names = (await sql<{ name: string }>`SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'ec_seed_indexes'`.execute(storage.database.db)).rows.map(row => row.name);
      expect(names).toContain('idx_ec_seed_indexes_primary_byline');
      expect(names).toContain('idx_ec_seed_indexes_status');
    } finally { await storage.close(); }
  }, 30000);
}
