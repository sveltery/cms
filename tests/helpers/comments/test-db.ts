// Original native host for complete pinned callbacks. No canonical provider or auth probe.
import { sql, type Kysely } from 'kysely';
import { openSqlite } from '../../../src/lib/server/database/sqlite.ts';
import { migrateCms } from '../../../src/lib/server/database/migrations.ts';
import { SchemaRegistry } from '../../../src/lib/server/database/registry.ts';
import { commentSchemaStatements } from '../../../src/lib/server/comments/migrations.ts';
import type { Database } from '../../../src/lib/server/comments/upstream/database/types.ts';
import { commentNamespacePlugin } from '../../../src/lib/server/comments/namespace.ts';

const owned = new WeakMap<object, ReturnType<typeof openSqlite>>();
export async function setupTestDatabase(): Promise<Kysely<Database>> {
  const database = openSqlite(':memory:');
  await migrateCms(database);
  await database.atomicBatch(commentSchemaStatements(database.db));
  // This actual SQLite view/trigger adapts unchanged Source fixture inserts to
  // real native current-role users and profile rows. It is never app-owned DDL.
  await sql`CREATE VIEW users AS SELECT u.id, u.role, p.email, p.name, p.email_verified,
    p.created_at FROM _cms_auth_users u JOIN _cms_auth_profiles p ON p.user_id = u.id`.execute(database.db);
  await sql`CREATE TRIGGER comments_source_user_insert INSTEAD OF INSERT ON users BEGIN
    INSERT INTO _cms_auth_users(id, role, disabled) VALUES(NEW.id, NEW.role, 0);
    INSERT INTO _cms_auth_profiles(user_id, email, name, email_verified, created_at, updated_at)
    VALUES(NEW.id, NEW.email, NEW.name, COALESCE(NEW.email_verified, 0), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  END`.execute(database.db);
  const db = database.db.withTables<Database>().$pickTables<keyof Database>().withPlugin(commentNamespacePlugin);
  owned.set(db, database);
  return db;
}
export async function setupTestDatabaseWithCollections(): Promise<Kysely<Database>> {
  const db = await setupTestDatabase();
  const database = owned.get(db)!;
  const registry = new SchemaRegistry(database);
  for (const slug of ['post', 'page']) {
    await registry.createCollection({ slug, label: slug });
    await registry.createField(slug, { slug: 'title', label: 'Title', type: 'string' });
    await registry.createField(slug, { slug: 'content', label: 'Content', type: 'portableText' });
  }
  return db;
}
export async function teardownTestDatabase(db: Kysely<Database> | undefined): Promise<void> {
  if (db) await owned.get(db)?.close();
}
