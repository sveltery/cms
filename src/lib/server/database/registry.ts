import { sql, type CompiledQuery } from 'kysely';
import { sqliteErrorMessage } from './errors.ts';
import { ulid } from 'ulidx';
import { CmsError, type CmsDatabase, type Collection, type CollectionRow, type Field, type FieldRow, type RevisionPrecondition } from './contract.ts';
import { collectionInput, collectionMetadataInput, fieldInput, fieldLabelInput, identifier, parse, reservedCollections, reservedFields, revisionInput, tableName } from './validation.ts';
import { trashIndexStatement } from './trash-index.ts';
import { fieldEditInput } from './field-edit-validation.ts';

export const MAX_COLLECTIONS = 100;
export const MAX_FIELDS = 32;
const fieldMax = (input: { type: string; validation?: { maxLength?: number } | null }) =>
  Math.min(input.validation?.maxLength ?? (input.type === 'string' ? 200 : 100_000), 100_000);

function collection(row: CollectionRow): Collection {
  return { id: row.id, slug: row.slug, label: row.label, labelSingular: row.label_singular,
    description: row.description, supports: JSON.parse(row.supports), source: 'manual',
    version: row.version, createdAt: row.created_at, updatedAt: row.updated_at };
}
function field(row: FieldRow): Field {
  return { id: row.id, collectionId: row.collection_id, slug: row.slug, label: row.label,
    type: row.type, columnType: row.column_type, required: row.required === 1, unique: row.unique === 1,
    ...(row.default_value === null ? {} : { defaultValue: JSON.parse(row.default_value) as string }),
    validation: row.validation === null ? null : JSON.parse(row.validation),
    sortOrder: row.sort_order, createdAt: row.created_at };
}
export class SchemaRegistry {
  private readonly database: CmsDatabase;
  constructor(database: CmsDatabase) { this.database = database; }

  async getCollection(input: unknown): Promise<Collection | null> {
    const slug = parse(identifier, input);
    const row = await this.database.db.selectFrom('_cms_collections').selectAll().where('slug', '=', slug).executeTakeFirst();
    return row ? collection(row) : null;
  }
  async listCollections(): Promise<Collection[]> {
    const rows = await this.database.db.selectFrom('_cms_collections').selectAll().orderBy('slug').limit(MAX_COLLECTIONS).execute();
    return rows.map(collection);
  }
  // EmDash registry.ts updateCollection: supplied metadata only; no schema-version bump.
  // Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
  // The trusted service requires CAS; direct registry calls may omit a precondition.
  async updateCollection(slug: unknown, input: unknown, expected?: RevisionPrecondition): Promise<Collection> {
    const value = parse(collectionMetadataInput, input);
    const precondition = expected === undefined ? undefined : parse(revisionInput, expected);
    const definition = await this.getCollection(slug);
    if (!definition) throw new CmsError('NOT_FOUND');
    if (precondition && (precondition.version !== definition.version || precondition.updatedAt !== definition.updatedAt)) {
      throw new CmsError('CONFLICT');
    }
    const db = this.database.db;
    const token = ulid();
    // A distinct timestamp keeps same-millisecond/backward-clock metadata writes
    // observable to CAS while schema version remains unchanged. See collection-update.md.
    const updatedAt = new Date(Math.max(Date.now(), Date.parse(definition.updatedAt) + 1)).toISOString();
    const updates: Partial<CollectionRow> = { updated_at: updatedAt };
    if (value.label !== undefined) updates.label = value.label;
    if (value.labelSingular !== undefined) updates.label_singular = value.labelSingular;
    if (value.description !== undefined) updates.description = value.description;
    if (value.supports !== undefined) updates.supports = JSON.stringify(value.supports);
    const results = await this.batch([
      sql`INSERT INTO _cms_guards(token, pass) SELECT ${token},
        CASE WHEN EXISTS (SELECT 1 FROM _cms_collections WHERE id = ${definition.id}
          AND version = ${definition.version} AND updated_at = ${definition.updatedAt})
        THEN 1 ELSE 0 END`.compile(db),
      db.updateTable('_cms_collections').set(updates).where('id', '=', definition.id).returningAll().compile(),
      sql`DELETE FROM _cms_guards WHERE token = ${token}`.compile(db)
    ], 'CONFLICT');
    // Read the operation's own RETURNING row, rather than a later concurrent writer.
    return collection(results[1].rows[0] as CollectionRow);
  }
  async listFields(collectionId: string): Promise<Field[]> {
    const rows = await this.database.db.selectFrom('_cms_fields').selectAll().where('collection_id', '=', collectionId)
      .orderBy('sort_order').orderBy('id').limit(MAX_FIELDS).execute();
    return rows.map(field);
  }
  async getField(collectionSlug: unknown, fieldSlug: unknown): Promise<Field | null> {
    const slug = parse(identifier, fieldSlug);
    const definition = await this.getCollection(collectionSlug);
    if (!definition) return null;
    const row = await this.database.db.selectFrom('_cms_fields').selectAll().where('collection_id', '=', definition.id)
      .where('slug', '=', slug).executeTakeFirst();
    return row ? field(row) : null;
  }
  async getCollectionWithFields(slug: unknown): Promise<(Collection & { fields: Field[] }) | null> {
    const definition = await this.getCollection(slug);
    return definition ? { ...definition, fields: await this.listFields(definition.id) } : null;
  }

  // String/text metadata subset of EmDash 1.1.0 registry.ts updateField:1542,
  // pinned at 913cb1bb. Supplied keys only; no DDL or content-row changes.
  // Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
  async updateField(collectionSlug: unknown, fieldSlug: unknown, input: unknown): Promise<Field> {
    const value = parse(fieldEditInput, input);
    const target = await this.getField(collectionSlug, fieldSlug);
    if (!target) throw new CmsError('NOT_FOUND');
    const updates: Partial<FieldRow> = {};
    if (value.label !== undefined) updates.label = value.label;
    if (value.sortOrder !== undefined) updates.sort_order = value.sortOrder;
    if (value.defaultValue !== undefined) updates.default_value = JSON.stringify(value.defaultValue);
    if (value.validation !== undefined) updates.validation = value.validation === null ? null : JSON.stringify(value.validation);
    if (Object.keys(updates).length === 0) return target;
    const db = this.database.db;
    // Preserve the resolved identity, and return this write's row even if a later writer wins.
    // No schema/metadata precondition or collection touch: fields are last-writer-wins.
    const results = await this.database.atomicBatch([
      db.updateTable('_cms_fields').set(updates)
        .where('id', '=', target.id).where('collection_id', '=', target.collectionId)
        .where('slug', '=', target.slug)
        .where('type', 'in', ['string', 'text'])
        .where('collection_id', 'in', db.selectFrom('_cms_collections').select('id')
          .where('id', '=', target.collectionId).where('slug', '=', parse(identifier, collectionSlug)))
        .returningAll().compile()
    ]);
    const row = results[0].rows[0] as FieldRow | undefined;
    if (!row) throw new CmsError('NOT_FOUND');
    return field(row);
  }

  async updateFieldLabel(collectionSlug: unknown, fieldSlug: unknown, input: unknown): Promise<Field> {
    return this.updateField(collectionSlug, fieldSlug, parse(fieldLabelInput, input));
  }

  async createCollection(input: unknown): Promise<Collection> {
    const value = parse(collectionInput, input);
    if (reservedCollections.includes(value.slug)) throw new CmsError('RESERVED_SLUG');
    if (await this.getCollection(value.slug)) throw new CmsError('COLLECTION_EXISTS');
    const db = this.database.db;
    const name = tableName(value.slug);
    const exists = await sql`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ${name}`.execute(db);
    if (exists.rows.length) {
      // Another creator may have committed between the registry and table preflight reads.
      if (await this.getCollection(value.slug)) throw new CmsError('COLLECTION_EXISTS');
      throw new CmsError('COLLECTION_TABLE_ORPHANED');
    }
    const token = ulid();
    const now = new Date().toISOString();
    const statements: CompiledQuery[] = [
      sql`INSERT INTO _cms_guards(token, pass)
        SELECT ${token}, CASE WHEN (SELECT COUNT(*) FROM _cms_collections) < ${MAX_COLLECTIONS} THEN 1 ELSE 0 END`.compile(db),
      db.insertInto('_cms_collections').values({
        id: ulid(), slug: value.slug, label: value.label, label_singular: value.labelSingular ?? null,
        description: value.description ?? null, supports: JSON.stringify(value.supports ?? ['drafts', 'revisions']),
        source: 'manual', version: 1, created_at: now, updated_at: now
      }).compile(),
      sql`CREATE TABLE ${sql.ref(name)} (
        id TEXT PRIMARY KEY NOT NULL, slug TEXT, status TEXT NOT NULL DEFAULT 'draft' CHECK(status = 'draft'),
        author_id TEXT, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        published_at TEXT, scheduled_at TEXT, deleted_at TEXT,
        version INTEGER NOT NULL DEFAULT 1 CHECK(version > 0),
        live_revision_id TEXT, draft_revision_id TEXT,
        locale TEXT NOT NULL DEFAULT 'en', translation_group TEXT,
        UNIQUE(slug, locale)
      )`.compile(db),
      db.schema.createIndex('idx_' + name + '_draft_list').on(name).columns(['locale', 'deleted_at', 'created_at', 'id']).compile(),
      trashIndexStatement(this.database, value.slug),
      sql`DELETE FROM _cms_guards WHERE token = ${token}`.compile(db)
    ];
    try { await this.batch(statements, 'LIMIT_EXCEEDED'); }
    catch (cause) {
      // Classify only SQLite's exact registered-slug uniqueness failure after a concurrent create.
      // Other constraints, DDL and adapter failures remain unexpected server errors.
      const duplicateSlug = sqliteErrorMessage(cause) === 'UNIQUE constraint failed: _cms_collections.slug';
      // At the final capacity slot, the guard can fail before the duplicate insert is attempted.
      const duplicateAtCapacity = cause instanceof CmsError && cause.code === 'LIMIT_EXCEEDED'
        && await this.getCollection(value.slug) !== null;
      if (duplicateSlug || duplicateAtCapacity) throw new CmsError('COLLECTION_EXISTS');
      throw cause;
    }
    return (await this.getCollection(value.slug))!;
  }

  async createField(collectionSlug: unknown, input: unknown, expectedSchemaVersion?: number): Promise<Field> {
    const value = parse(fieldInput, input);
    if (reservedFields.includes(value.slug)) throw new CmsError('RESERVED_SLUG');
    const definition = await this.getCollection(collectionSlug);
    if (!definition) throw new CmsError('NOT_FOUND');
    if (expectedSchemaVersion !== undefined && (!Number.isSafeInteger(expectedSchemaVersion) || expectedSchemaVersion < 1)) throw new CmsError('VALIDATION_ERROR');
    if (expectedSchemaVersion !== undefined && definition.version !== expectedSchemaVersion) throw new CmsError('CONFLICT');
    if (await this.getField(definition.slug, value.slug)) throw new CmsError('FIELD_EXISTS');
    const maximum = fieldMax(value);
    const minimum = value.validation?.minLength ?? 0;
    if (minimum > maximum) throw new CmsError('VALIDATION_ERROR');
    if (value.defaultValue !== undefined && (value.defaultValue.length < minimum || value.defaultValue.length > maximum)) throw new CmsError('VALIDATION_ERROR');
    const db = this.database.db;
    const token = ulid();
    const id = ulid();
    const name = tableName(definition.slug);
    const fields = await this.listFields(definition.id);
    if (fields.length >= MAX_FIELDS) throw new CmsError('LIMIT_EXCEEDED');
    const column = db.schema.alterTable(name).addColumn(value.slug, 'text', c => {
      let column = c;
      // EmDash 1.1.0 registry.ts addColumn: required scalar columns need a
      // physical default; optional defaults and unique remain metadata only.
      // Existing columns/indexes are untouched; see scalar-field-fidelity.md.
      if (value.required) column = column.notNull().defaultTo(sql.lit(value.defaultValue ?? ''));
      return column;
    });
    const statements: CompiledQuery[] = [
      sql`INSERT INTO _cms_guards(token, pass) SELECT ${token},
        CASE WHEN EXISTS (SELECT 1 FROM _cms_collections WHERE id = ${definition.id} AND version = ${definition.version})
        AND (SELECT COUNT(*) FROM _cms_fields WHERE collection_id = ${definition.id}) < ${MAX_FIELDS}
        THEN 1 ELSE 0 END`.compile(db),
      column.compile(),
      db.insertInto('_cms_fields').values({
        id, collection_id: definition.id, slug: value.slug, label: value.label, type: value.type, column_type: 'TEXT',
        required: value.required ? 1 : 0, unique: value.unique ? 1 : 0,
        default_value: value.defaultValue === undefined ? null : JSON.stringify(value.defaultValue),
        validation: value.validation === undefined ? null : JSON.stringify(value.validation),
        sort_order: fields.length, created_at: new Date().toISOString()
      }).compile(),
      db.updateTable('_cms_collections').set({ version: definition.version + 1, updated_at: new Date().toISOString() }).where('id', '=', definition.id).compile()
    ];
    statements.push(sql`DELETE FROM _cms_guards WHERE token = ${token}`.compile(db));
    await this.batch(statements, 'CONFLICT');
    return (await this.getField(definition.slug, value.slug))!;
  }
  private async batch(statements: CompiledQuery[], guardCode: 'LIMIT_EXCEEDED' | 'CONFLICT') {
    try { return await this.database.atomicBatch(statements); }
    catch (cause) {
      // Only the deliberate SQL guard's CHECK failure becomes a domain conflict.
      if (cause instanceof Error && /CHECK constraint failed: pass = 1/.test(cause.message)) throw new CmsError(guardCode);
      throw cause;
    }
  }
}
export { fieldMax };
