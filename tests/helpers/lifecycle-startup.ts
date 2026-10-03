import { sql } from 'kysely';
import { readFileSync } from 'node:fs';
import type { CmsDatabase } from '../../src/lib/server/database/contract.ts';
import { CMS_MIGRATIONS } from '../../src/lib/server/database/migrations.ts';
import { SchemaRegistry } from '../../src/lib/server/database/registry.ts';
import { DraftRepository } from '../../src/lib/server/database/entries.ts';
import { sqliteErrorMessage } from '../../src/lib/server/database/errors.ts';
import { trashIndexStatement } from '../../src/lib/server/database/trash-index.ts';

/** Immutable pre-v5 local table layout. Supplemental upgrade setup only. */
export const legacyContentSql = `CREATE TABLE ec_post (
  id TEXT PRIMARY KEY NOT NULL, slug TEXT, status TEXT NOT NULL DEFAULT 'draft' CHECK(status = 'draft'),
  author_id TEXT, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  published_at TEXT, scheduled_at TEXT, deleted_at TEXT,
  version INTEGER NOT NULL DEFAULT 1 CHECK(version > 0),
  live_revision_id TEXT, draft_revision_id TEXT,
  locale TEXT NOT NULL DEFAULT 'en', translation_group TEXT, UNIQUE(slug, locale)
)`;

export async function installVersion4(database: CmsDatabase) {
  await database.atomicBatch([
    sql`CREATE TABLE _cms_migrations (version INTEGER PRIMARY KEY CHECK(version > 0))`.compile(database.db),
    ...await CMS_MIGRATIONS[0].statements(database),
    sql`INSERT INTO _cms_migrations VALUES (1)`.compile(database.db)
  ]);
  for (const provider of CMS_MIGRATIONS.slice(1, 4)) await database.atomicBatch([
    ...await provider.statements(database), sql`INSERT INTO _cms_migrations VALUES (${sql.lit(provider.version)})`.compile(database.db)
  ]);
}

export async function installHistoricalVersion(database:CmsDatabase, version:1|2) {
  const statements = JSON.parse(readFileSync(new URL('../fixtures/cms-v1.json',import.meta.url),'utf8')) as string[];
  await database.atomicBatch(statements.map(statement=>sql.raw(statement).compile(database.db)));
  if (version===2) await database.atomicBatch([
    ...await CMS_MIGRATIONS[1].statements(database),
    sql`ALTER TABLE _cms_migrations RENAME TO _cms_migrations_v1`.compile(database.db),
    sql`CREATE TABLE _cms_migrations (version INTEGER PRIMARY KEY CHECK(version IN (1, 2)))`.compile(database.db),
    sql`INSERT INTO _cms_migrations VALUES (1),(2)`.compile(database.db),
    sql`DROP TABLE _cms_migrations_v1`.compile(database.db)
  ]);
}

export async function legacyPost(database: CmsDatabase) {
  const registry = new SchemaRegistry(database);
  await registry.createCollection({ slug: 'post', label: 'Posts' });
  // Create the historical ec table even after the registry begins creating v5.
  await database.atomicBatch([
    sql`DROP TABLE ec_post`.compile(database.db), sql.raw(legacyContentSql).compile(database.db),
    sql`CREATE INDEX idx_ec_post_draft_list ON ec_post (locale, deleted_at, created_at, id)`.compile(database.db),
    trashIndexStatement(database,'post')
  ]);
  await registry.createField('post', { slug: 'title', label: 'Title', type: 'string' });
  return registry;
}

/** Storage facade, not a lifecycle implementation or a repository parity claim. */
export async function createStoredContent(database: CmsDatabase, input: {
  slug: string; status?: string; primaryBylineId?: string; authorId?: string;
}) {
  const entry = await new DraftRepository(database).create({type:'post', slug:input.slug, data:{title:'Test Post'}}, input.authorId ?? 'author-1');
  try {
    if (input.status) await sql`UPDATE ec_post SET status=${input.status} WHERE id=${entry.id}`.execute(database.db);
    if (input.primaryBylineId) await sql`UPDATE ec_post SET primary_byline_id=${input.primaryBylineId} WHERE id=${entry.id}`.execute(database.db);
  } catch (cause) {
    // A baseline storage capability failure retains its actual persisted row so
    // source expectations fail at the assertion rather than in fixture setup.
    const message = sqliteErrorMessage(cause) ?? '';
    if (!message.includes("CHECK constraint failed: status = 'draft'") && !message.includes('no such column: primary_byline_id')) throw cause;
  }
  const row = (await sql<Record<string, unknown>>`SELECT * FROM ec_post WHERE id=${entry.id}`.execute(database.db)).rows[0];
  return {status:row.status, authorId:row.author_id, primaryBylineId:row.primary_byline_id};
}

export async function queryRevisionRows(database: CmsDatabase) {
  try { return (await sql`SELECT * FROM _cms_revisions`.execute(database.db)).rows; }
  catch (cause) {
    if (!(sqliteErrorMessage(cause) ?? '').includes('no such table: _cms_revisions')) throw cause;
    return undefined;
  }
}

export async function databaseSnapshot(database: CmsDatabase) {
  const objects = (await sql<{name:string;type:string;sql:string}>`SELECT name,type,sql FROM sqlite_master WHERE name NOT GLOB '_cf_*' ORDER BY name`.execute(database.db)).rows;
  const tables = [];
  for (const object of objects.filter(row => row.type === 'table' && !row.name.startsWith('sqlite_'))) tables.push({
    name:object.name, rows:(await sql`SELECT * FROM ${sql.ref(object.name)} ORDER BY rowid`.execute(database.db)).rows
  });
  return {objects,tables};
}
