import { sql, type CompiledQuery } from 'kysely';
import { ulid } from 'ulidx';
import { decodeCursor, encodeCursor } from './trash-cursor.ts';
import { CmsError, type CmsDatabase, type DraftEntry, type DraftSummary, type Field, type Page, type TrashedDraftEntry, type TrashedDraftSummary } from './contract.ts';
import { SchemaRegistry, fieldMax } from './registry.ts';
import { countTrashedDraftInput, createDraftInput, entryId, identifier, listTrashedDraftInput, localeInput, parse, restoreDraftInput, tableName, updateDraftInput, deleteDraftInput } from './validation.ts';

interface EntryRow {
  id: string; slug: string | null; status: 'draft'; author_id: string | null;
  locale: string; version: number; created_at: string; updated_at: string;
  deleted_at?: string | null;
  [key: string]: unknown;
}
function entry(type: string, row: EntryRow, fields: Field[]): DraftEntry {
  const data: Record<string, string | null> = {};
  for (const field of fields) if (row[field.slug] !== undefined) data[field.slug] = row[field.slug] as string | null;
  return { id: row.id, type, slug: row.slug, status: row.status, authorId: row.author_id,
    locale: row.locale, version: row.version, createdAt: row.created_at, updatedAt: row.updated_at, data };
}
function validateData(fields: Field[], data: Record<string, string | null>, partial: boolean) {
  // Pinned zod-generator.ts builds every truthy pattern before parsing data.
  // Preserve eager legacy SyntaxError even for omitted/null/untouched fields.
  // Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
  const patterns = new Map<string, RegExp>();
  for (const field of fields) if (field.validation?.pattern) {
    patterns.set(field.slug, new RegExp(field.validation.pattern));
  }
  const known = new Map(fields.map(field => [field.slug, field]));
  for (const [key, value] of Object.entries(data)) {
    const field = known.get(key);
    if (!field || (field.required && (value === null || value === '')) ||
      (typeof value === 'string' && (value.length < (field.validation?.minLength ?? 0) || value.length > fieldMax(field)
        || patterns.get(key)?.test(value) === false))) {
      throw new CmsError('VALIDATION_ERROR');
    }
  }
  if (!partial) for (const field of fields) {
    if (field.required && !Object.hasOwn(data, field.slug) && field.defaultValue === undefined) throw new CmsError('VALIDATION_ERROR');
  }
}
function cursorEncode(type: string, locale: string, row: EntryRow): string {
  return btoa(JSON.stringify({ type, locale, createdAt: row.created_at, id: row.id }));
}
function cursorDecode(input: unknown, type: string, locale: string): { createdAt: string; id: string } {
  if (typeof input !== 'string' || input.length > 2048) throw new CmsError('VALIDATION_ERROR');
  try {
    const value = JSON.parse(atob(input)) as Record<string, unknown>;
    if (value.type !== type || value.locale !== locale || typeof value.createdAt !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value.createdAt)) throw new Error();
    return { createdAt: value.createdAt, id: parse(entryId, value.id) };
  } catch { throw new CmsError('VALIDATION_ERROR'); }
}

/** Internal storage API. Request callers must use cmsService for authorization. */
export class DraftRepository {
  private readonly registry: SchemaRegistry;
  private readonly database: CmsDatabase;
  constructor(database: CmsDatabase) { this.database = database; this.registry = new SchemaRegistry(database); }

  private async definition(type: string) {
    const definition = await this.registry.getCollectionWithFields(type);
    if (!definition) throw new CmsError('NOT_FOUND');
    return definition;
  }
  async create(input: unknown, authorId: string): Promise<DraftEntry> {
    const value = parse(createDraftInput, input);
    if (!authorId || authorId.length > 128) throw new CmsError('VALIDATION_ERROR');
    const definition = await this.definition(value.type);
    validateData(definition.fields, value.data, false);
    const id = ulid();
    const now = new Date().toISOString();
    const columns = ['id', 'slug', 'status', 'author_id', 'created_at', 'updated_at', 'version', 'locale', 'translation_group', ...Object.keys(value.data)];
    const values = [id, value.slug || null, 'draft', authorId, now, now, 1, value.locale, id, ...Object.values(value.data)];
    const db = this.database.db;
    const query = sql<EntryRow>`INSERT INTO ${sql.ref(tableName(value.type))}
      (${sql.join(columns.map(column => sql.ref(column)))})
      VALUES (${sql.join(values.map(item => sql`${item}`))}) RETURNING *`.compile(db);
    const result = await this.withSchemaGuard(definition.id, definition.version, query);
    return entry(value.type, result[1].rows[0] as EntryRow, definition.fields);
  }
  async findById(typeInput: unknown, idInput: unknown, locale = 'en'): Promise<DraftEntry | null> {
    const type = parse(identifier, typeInput); const id = parse(entryId, idInput);
    parse(localeInput, locale);
    const definition = await this.definition(type);
    const result = await sql<EntryRow>`SELECT * FROM ${sql.ref(tableName(type))}
      WHERE id = ${id} AND locale = ${locale} AND deleted_at IS NULL`.execute(this.database.db);
    return result.rows[0] ? entry(type, result.rows[0], definition.fields) : null;
  }
  private async trashLookup(typeInput: unknown, idInput: unknown, locale: string | undefined, onlyTrashed: boolean) {
    const type = parse(identifier, typeInput); const id = parse(entryId, idInput);
    if (locale !== undefined) parse(localeInput, locale);
    const definition = await this.definition(type);
    const result = await sql<EntryRow>`SELECT * FROM ${sql.ref(tableName(type))}
      WHERE id = ${id} AND status = 'draft'
      ${locale === undefined ? sql`` : sql`AND locale = ${locale}`}
      ${onlyTrashed ? sql`AND deleted_at IS NOT NULL` : sql``}`.execute(this.database.db);
    const row = result.rows[0];
    return row ? { ...entry(type, row, definition.fields), deletedAt: row.deleted_at ?? null } : null;
  }
  async findByIdIncludingTrashed(type: unknown, id: unknown, locale?: string): Promise<(DraftEntry & { deletedAt: string | null }) | null> {
    return this.trashLookup(type, id, locale, false);
  }
  async findTrashedById(type: unknown, id: unknown, locale?: string): Promise<TrashedDraftEntry | null> {
    const row = await this.trashLookup(type, id, locale, true);
    return row && row.deletedAt !== null ? { ...row, deletedAt: row.deletedAt } : null;
  }
  // Draft-only adaptation of EmDash 1.1.0 ContentRepository.countTrashed:1770.
  // Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
  async countTrashed(typeInput: unknown, options: { locale?: string } = {}): Promise<number> {
    const { type, locale } = parse(countTrashedDraftInput, { ...options, type: typeInput });
    await this.definition(type);
    const result = await sql<{ count: number | string | bigint }>`SELECT count(id) AS count FROM ${sql.ref(tableName(type))}
      WHERE deleted_at IS NOT NULL AND status = 'draft'
      ${locale === undefined ? sql`` : sql`AND locale = ${locale}`}`.execute(this.database.db);
    return Number(result.rows[0]?.count || 0);
  }
  async listTrashed(typeInput: unknown, options: { limit?: number; locale?: string; cursor?: string } = {}): Promise<Page<TrashedDraftSummary>> {
    const { type, locale, cursor: encoded, limit: requested = 50 } = parse(listTrashedDraftInput, { ...options, type: typeInput });
    const limit = Math.min(requested, 100);
    // Pinned findTrashed treats an empty cursor as the first page.
    const cursor = encoded ? decodeCursor(encoded) : undefined;
    const definition = await this.definition(type);
    const title = definition.fields.some(field => field.slug === 'title') ? sql`substr(${sql.ref('title')}, 1, 200)` : sql`NULL`;
    const result = await sql<EntryRow & { title: string | null; deleted_at: string }>`SELECT id, slug, status, author_id, locale,
      version, created_at, updated_at, deleted_at, ${title} AS title FROM ${sql.ref(tableName(type))}
      WHERE deleted_at IS NOT NULL AND status = 'draft'
      ${locale === undefined ? sql`` : sql`AND locale = ${locale}`}
       ${cursor ? sql`AND (deleted_at < ${cursor.orderValue} OR (deleted_at = ${cursor.orderValue} AND id < ${cursor.id}))` : sql``}
      ORDER BY deleted_at DESC, id DESC LIMIT ${limit + 1}`.execute(this.database.db);
    const rows = result.rows.slice(0, limit);
    return { items: rows.map(row => {
      const { data, ...summary } = entry(type, row, []);
      return { ...summary, title: row.title, deletedAt: row.deleted_at };
    }), ...(result.rows.length > limit ? { nextCursor: encodeCursor(rows[rows.length - 1].deleted_at, rows[rows.length - 1].id) } : {}) };
  }
  // Draft-only adaptation of pinned ContentRepository.restore. Ownership and both
  // revision tokens are SQL predicates; RETURNING is this write's committed receipt.
  // Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
  async restore(input: unknown, ownerId?: string): Promise<DraftEntry> {
    const value = parse(restoreDraftInput, input);
    const definition = await this.definition(value.type);
    const now = new Date(Math.max(Date.now(), Date.parse(value.expected.updatedAt) + 1)).toISOString();
    const query = sql<EntryRow>`UPDATE ${sql.ref(tableName(value.type))}
      SET deleted_at = NULL, live_revision_id = NULL, scheduled_at = NULL, status = 'draft',
        updated_at = ${now}, version = version + 1
      WHERE id = ${value.id} AND locale = ${value.locale} AND deleted_at IS NOT NULL AND status = 'draft'
      AND version = ${value.expected.version} AND updated_at = ${value.expected.updatedAt}
      ${ownerId === undefined ? sql`` : sql`AND author_id = ${ownerId}`}
      RETURNING *`.compile(this.database.db);
    const result = await this.withSchemaGuard(definition.id, definition.version, query);
    if (!result[1].rows.length) {
      if (!await this.findByIdIncludingTrashed(value.type, value.id, value.locale)) throw new CmsError('NOT_FOUND');
      throw new CmsError('CONFLICT');
    }
    return entry(value.type, result[1].rows[0] as EntryRow, definition.fields);
  }
  async update(input: unknown, ownerId?: string): Promise<DraftEntry> {
    const value = parse(updateDraftInput, input);
    const definition = await this.definition(value.type);
    validateData(definition.fields, value.data, true);
    const db = this.database.db;
    const assignments = Object.entries(value.data).map(([key, item]) => sql`${sql.ref(key)} = ${item}`);
    if (value.slug !== undefined) assignments.push(sql`slug = ${value.slug || null}`);
    // Upstream increments version even for an empty update. updated_at only changes for column writes.
    if (assignments.length) assignments.push(sql`updated_at = ${new Date().toISOString()}`);
    assignments.push(sql`version = version + 1`);
    const query = sql<EntryRow>`UPDATE ${sql.ref(tableName(value.type))}
      SET ${sql.join(assignments)}
      WHERE id = ${value.id} AND locale = ${value.locale} AND deleted_at IS NULL AND status = 'draft'
      AND version = ${value.expected.version} AND updated_at = ${value.expected.updatedAt}
      ${ownerId === undefined ? sql`` : sql`AND author_id = ${ownerId}`}
      RETURNING *`.compile(db);
    const result = await this.withSchemaGuard(definition.id, definition.version, query);
    if (!result[1].rows.length) await this.missingOrConflict(value.type, value.id, value.locale);
    return entry(value.type, result[1].rows[0] as EntryRow, definition.fields);
  }
  async delete(input: unknown, ownerId?: string): Promise<void> {
    const value = parse(deleteDraftInput, input);
    const now = new Date().toISOString();
    const result = await sql`UPDATE ${sql.ref(tableName(value.type))}
      SET deleted_at = ${now}, updated_at = ${now}, version = version + 1
      WHERE id = ${value.id} AND locale = ${value.locale} AND deleted_at IS NULL AND status = 'draft'
      AND version = ${value.expected.version} AND updated_at = ${value.expected.updatedAt}
      ${ownerId === undefined ? sql`` : sql`AND author_id = ${ownerId}`}
      RETURNING id`.execute(this.database.db);
    if (!result.rows.length) await this.missingOrConflict(value.type, value.id, value.locale);
  }
  async list(typeInput: unknown, options: { limit?: number; cursor?: string; locale?: string } = {}): Promise<Page<DraftSummary>> {
    const type = parse(identifier, typeInput); const locale = parse(localeInput, options.locale ?? 'en');
    const definition = await this.definition(type);
    const requested = options.limit ?? 50;
    if (!Number.isSafeInteger(requested) || requested < 1) throw new CmsError('VALIDATION_ERROR');
    const limit = Math.min(requested, 100);
    const cursor = options.cursor === undefined ? undefined : cursorDecode(options.cursor, type, locale);
    const title = definition.fields.some(field => field.slug === 'title') ? sql`substr(${sql.ref('title')}, 1, 200)` : sql`NULL`;
    const result = await sql<EntryRow & { title: string | null }>`SELECT id, slug, status, author_id, locale, version, created_at, updated_at,
      ${title} AS title FROM ${sql.ref(tableName(type))}
      WHERE locale = ${locale} AND deleted_at IS NULL AND status = 'draft'
      ${cursor ? sql`AND (created_at < ${cursor.createdAt} OR (created_at = ${cursor.createdAt} AND id < ${cursor.id}))` : sql``}
      ORDER BY created_at DESC, id DESC LIMIT ${limit + 1}`.execute(this.database.db);
    const rows = result.rows.slice(0, limit);
    return {
      items: rows.map(row => {
        const { data, ...summary } = entry(type, row, []);
        return { ...summary, title: row.title };
      }),
      ...(result.rows.length > limit ? { nextCursor: cursorEncode(type, locale, rows[rows.length - 1]) } : {})
    };
  }
  private async missingOrConflict(type: string, id: string, locale: string): Promise<never> {
    if (!await this.findById(type, id, locale)) throw new CmsError('NOT_FOUND');
    throw new CmsError('CONFLICT');
  }
  private async withSchemaGuard(collectionId: string, version: number, query: CompiledQuery) {
    const db = this.database.db; const token = ulid();
    try {
      return await this.database.atomicBatch([
        sql`INSERT INTO _cms_guards(token, pass) SELECT ${token},
          CASE WHEN EXISTS (SELECT 1 FROM _cms_collections WHERE id = ${collectionId} AND version = ${version}) THEN 1 ELSE 0 END`.compile(db),
        query, sql`DELETE FROM _cms_guards WHERE token = ${token}`.compile(db)
      ]);
    } catch (cause) {
      if (cause instanceof Error && /CHECK constraint failed: pass = 1|UNIQUE constraint failed:/.test(cause.message)) throw new CmsError('CONFLICT');
      throw cause;
    }
  }
}
