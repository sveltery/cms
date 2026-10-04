import { sql, type CompiledQuery } from 'kysely';
import { sqliteErrorMessage } from './errors.ts';
import { ulid } from 'ulidx';
import { CmsError, type CmsDatabase, type Collection, type CollectionRow, type Field, type FieldRow, type RevisionPrecondition } from './contract.ts';
import { collectionInput, collectionMetadataInput, fieldInput, fieldLabelInput, identifier, parse, reservedCollections, reservedFields, revisionInput, tableName } from './validation.ts';
import { trashIndexStatement } from './trash-index.ts';
import { bylineIndexPrerequisiteChanged, collectionPrimaryBylinePlan } from './canonical-features/byline-index-plan.ts';
import { FIELD_TYPE_TO_COLUMN, FIELD_TYPES, REPEATER_SUB_FIELD_TYPES, isIndexableFieldType, isStoragelessField, type CollectionSource } from '../schema/types.ts';
import { fieldEditInput } from './field-edit-validation.ts';
import { FTSManager } from '../content-picker/fts-manager.ts';

export const MAX_COLLECTIONS = 100;
export const MAX_FIELDS = 32;
const fieldMax = (input: { type: string; validation?: { maxLength?: number } | null }) =>
  Math.min(input.validation?.maxLength ?? (input.type === 'string' ? 200 : 100_000), 100_000);

function collection(row: CollectionRow): Collection {
  return { id: row.id, slug: row.slug, label: row.label, labelSingular: row.label_singular,
    description: row.description, supports: JSON.parse(row.supports), source: (row.source ?? 'manual') as CollectionSource,
    icon: row.icon ?? undefined, admin: row.admin_config ? JSON.parse(row.admin_config) : undefined,
    hasSeo: row.has_seo === 1, titleField: row.title_field ?? undefined, dateField: row.date_field ?? undefined,
    urlPattern: row.url_pattern ?? undefined, routable: row.routable !== 0, hidden: row.hidden === 1,
    sortOrder: row.sort_order ?? undefined, group: row.nav_group ?? undefined,
    commentsEnabled: row.comments_enabled === 1, commentsModeration: (row.comments_moderation ?? 'first_time') as Collection['commentsModeration'],
    commentsClosedAfterDays: row.comments_closed_after_days ?? 90, commentsAutoApproveUsers: row.comments_auto_approve_users === 1, editLocking: row.edit_locking !== 0,
    version: row.version, createdAt: row.created_at, updatedAt: row.updated_at };
}
function field(row: FieldRow): Field {
  const validation = row.validation === null ? null : JSON.parse(row.validation);
  const unsupportedType = !FIELD_TYPES.includes(row.type) ? {type:row.type,path:'type'} : row.type === 'repeater' && Array.isArray(validation?.subFields) ? validation.subFields.flatMap((item: {type: string},index: number) => REPEATER_SUB_FIELD_TYPES.includes(item.type as typeof REPEATER_SUB_FIELD_TYPES[number]) ? [] : [{type:item.type,path:`validation.subFields[${index}].type`}])[0] : undefined;
  return { id: row.id, collectionId: row.collection_id, slug: row.slug, label: row.label,
    type: FIELD_TYPES.includes(row.type) ? row.type : 'string', unsupportedType, columnType: row.column_type, required: row.required === 1, unique: row.unique === 1,
    ...(row.default_value === null ? {} : { defaultValue: JSON.parse(row.default_value) }),
    validation: row.validation === null ? null : JSON.parse(row.validation),
    widget: row.widget ?? undefined, options: row.options ? JSON.parse(row.options) : undefined,
    searchable: row.searchable === 1, indexed: row.indexed === 1, translatable: row.translatable !== 0,
    sortOrder: row.sort_order, createdAt: row.created_at };
}
/** Shared persisted-field projection for registry and trusted batched editor manifests. */
export { field as fieldFromRow };
export class SchemaRegistry {
  private readonly database: CmsDatabase;
  private readonly searchOwner: FTSManager;
  constructor(database: CmsDatabase, searchOwner?: FTSManager) {
    this.database = database;
    this.searchOwner = searchOwner ?? new FTSManager(database.db as any);
  }

  async getCollection(input: unknown): Promise<Collection | null> {
    const slug = parse(identifier, input);
    const row = await this.database.db.selectFrom('_cms_collections').selectAll().where('slug', '=', slug).executeTakeFirst();
    return row ? collection(row) : null;
  }
  async listCollections(): Promise<Collection[]> {
    const rows = await this.database.db.selectFrom('_cms_collections').selectAll().orderBy('slug').limit(MAX_COLLECTIONS).execute();
    return rows.map(collection).sort((a,b) => (a.sortOrder === undefined ? 1 : 0) - (b.sortOrder === undefined ? 1 : 0) || (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.slug.localeCompare(b.slug));
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
    const updatedAt = nextMetadataTimestamp([definition]);
    const updates: Partial<CollectionRow> = { updated_at: updatedAt };
    if (value.label !== undefined) updates.label = value.label;
    if (value.labelSingular !== undefined) updates.label_singular = value.labelSingular;
    if (value.description !== undefined) updates.description = value.description;
    if (value.supports !== undefined) {
      updates.supports = JSON.stringify(value.supports);
      if (value.hasSeo === undefined) updates.has_seo = Number(value.supports.includes('seo'));
    }
    if(value.admin !== undefined) updates.admin_config = JSON.stringify(value.admin);
    for (const [key,column] of Object.entries(collectionMetadataColumns)) {
      const item = value[key as keyof typeof value];
      if (item !== undefined) (updates as Record<string,unknown>)[column] = typeof item === 'boolean' ? Number(item) : (item === '' ? null : item);
    }
    if (value.titleField) {
      const field = await this.getField(definition.slug,value.titleField);
      if(!field || !['string','text','slug'].includes(field.type)) throw new CmsError('INVALID_TITLE_FIELD');
    }
    if (value.dateField) {
      const field = await this.getField(definition.slug,value.dateField);
      if(!field || field.type !== 'datetime') throw new CmsError('INVALID_DATE_FIELD');
    }
    const searchPlan = value.supports !== undefined && definition.supports.includes('search') !== value.supports.includes('search')
      ? await this.searchOwner.schemaMutationPlan(definition.slug, value.supports, fields => fields) : { before: [], after: [] };
    const results = await this.batch([
      ...searchPlan.before,
      sql`INSERT INTO _cms_guards(token, pass) SELECT ${token},
        CASE WHEN EXISTS (SELECT 1 FROM _cms_collections WHERE id = ${definition.id}
          AND version = ${definition.version} AND updated_at = ${definition.updatedAt})
        THEN 1 ELSE 0 END`.compile(db),
      db.updateTable('_cms_collections').set(updates).where('id', '=', definition.id).returningAll().compile(),
      ...searchPlan.after,
      sql`DELETE FROM _cms_guards WHERE token = ${token}`.compile(db)
    ], 'CONFLICT');
    // Read the operation's own RETURNING row, rather than a later concurrent writer.
    return collection(results[searchPlan.before.length + 1].rows[0] as CollectionRow);
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
    if(target.unsupportedType) throw new CmsError('UNSUPPORTED_FIELD_TYPE');
    const nextType = value.type ?? target.type;
    if(value.type && value.type !== target.type) {
      if(FIELD_TYPE_TO_COLUMN[value.type] !== target.columnType) throw new CmsError('FIELD_TYPE_COLUMN_CHANGE');
      if(!['string','text','slug'].includes(target.type) || !['string','text','slug'].includes(value.type)) throw new CmsError('FIELD_TYPE_CHANGE_REQUIRES_MIGRATION');
      updates.type = value.type;
    }
    if((value.required !== undefined && value.required !== target.required) || (value.unique !== undefined && value.unique !== target.unique) || (value.translatable === false && target.translatable)) throw new CmsError('FIELD_UPDATE_REQUIRES_MIGRATION');
    const nextIndexed = value.indexed ?? target.indexed;
    if(nextIndexed && !isIndexableFieldType(nextType)) throw new CmsError('FIELD_NOT_INDEXABLE');
    if(value.required !== undefined) updates.required = Number(value.required);
    if(value.unique !== undefined) updates.unique = Number(value.unique);
    if(value.translatable !== undefined) updates.translatable = Number(value.translatable);
    if(value.searchable !== undefined) updates.searchable = Number(value.searchable);
    if(value.indexed !== undefined) updates.indexed = Number(value.indexed);
    if(value.widget !== undefined) updates.widget = value.widget;
    if(value.options !== undefined) updates.options = JSON.stringify(value.options);
    if (value.label !== undefined) updates.label = value.label;
    if (value.sortOrder !== undefined) updates.sort_order = value.sortOrder;
    if (value.defaultValue !== undefined) updates.default_value = JSON.stringify(value.defaultValue);
    if (value.validation !== undefined) updates.validation = value.validation === null ? null : JSON.stringify(value.validation);
    if (Object.keys(updates).length === 0) return target;
    const db = this.database.db;
    // Preserve the resolved identity, and return this write's row even if a later writer wins.
    // Ordinary metadata remains last-writer-wins. Active search rebuilds guard their
    // one-statement schema/config snapshot before this same atomic batch.
    const indexStatements = value.indexed === undefined ? [] : value.indexed ? this.fieldIndexStatements(parse(identifier,collectionSlug),target.id,target.slug) : this.dropFieldIndexStatements(target.id);
    const definition = await this.getCollection(collectionSlug); if (!definition) throw new CmsError('NOT_FOUND');
    const searchPlan = value.searchable !== undefined && value.searchable !== target.searchable
      ? await this.searchOwner.schemaMutationPlan(definition.slug, undefined, fields =>
        fields.map(item => item.id === target.id ? { ...item, searchable: value.searchable!, type: nextType,
          sortOrder: value.sortOrder ?? item.sortOrder } : item)
          .sort((left, right) => left.sortOrder - right.sortOrder), target)
      : { before: [], after: [] };
    const results = await this.batch([
      ...searchPlan.before,
      db.updateTable('_cms_fields').set(updates)
        .where('id', '=', target.id).where('collection_id', '=', target.collectionId)
        .where('slug', '=', target.slug)
        .where('collection_id', 'in', db.selectFrom('_cms_collections').select('id')
          .where('id', '=', target.collectionId).where('slug', '=', parse(identifier, collectionSlug)))
        .returningAll().compile(), ...indexStatements, ...searchPlan.after
    ], 'CONFLICT');
    const row = results[searchPlan.before.length].rows[0] as FieldRow | undefined;
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
    const primaryByline = await collectionPrimaryBylinePlan(this.database,value.slug);
    const token = ulid();
    const now = new Date().toISOString();
    const statements: CompiledQuery[] = [
      primaryByline.guard,
      sql`INSERT INTO _cms_guards(token, pass)
        SELECT ${token}, CASE WHEN (SELECT COUNT(*) FROM _cms_collections) < ${MAX_COLLECTIONS} THEN 1 ELSE 0 END`.compile(db),
      db.insertInto('_cms_collections').values({
        id: ulid(), slug: value.slug, label: value.label, label_singular: value.labelSingular ?? null,
        description: value.description ?? null, supports: JSON.stringify(value.supports ?? ['drafts', 'revisions']),
        source: value.source ?? 'manual',
        ...(value.hasSeo === undefined && value.supports?.includes('seo') ? { has_seo: 1 } : {}),
        version: 1, created_at: now, updated_at: now,
        ...Object.fromEntries(Object.entries(collectionMetadataColumns).flatMap(([key,column]) => {
          const item = value[key as keyof typeof value];
          return item === undefined ? [] : [[column,typeof item === 'boolean' ? Number(item) : item === '' ? null : item]];
        })), ...(value.admin === undefined ? {} : {admin_config:JSON.stringify(value.admin)})
      }).compile(),
      sql`CREATE TABLE ${sql.ref(name)} (
        id TEXT PRIMARY KEY NOT NULL, slug TEXT, status TEXT NOT NULL DEFAULT 'draft',
        author_id TEXT, primary_byline_id TEXT, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        published_at TEXT, scheduled_at TEXT, deleted_at TEXT,
        version INTEGER NOT NULL DEFAULT 1 CHECK(version > 0),
        live_revision_id TEXT, draft_revision_id TEXT,
        locale TEXT NOT NULL DEFAULT 'en', translation_group TEXT,
        UNIQUE(slug, locale)
      )`.compile(db),
      db.schema.createIndex('idx_' + name + '_draft_list').on(name).columns(['locale', 'deleted_at', 'created_at', 'id']).compile(),
      trashIndexStatement(this.database, value.slug),
      ...(primaryByline.index ? [primaryByline.index] : []),
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
    if (typeof value.defaultValue === 'string' && (value.defaultValue.length < minimum || value.defaultValue.length > maximum || value.defaultValue.includes('\0'))) throw new CmsError('VALIDATION_ERROR');
    const db = this.database.db;
    const token = ulid();
    const id = ulid();
    const name = tableName(definition.slug);
    const fields = await this.listFields(definition.id);
    if (fields.length >= MAX_FIELDS) throw new CmsError('LIMIT_EXCEEDED');
    if(value.indexed && !isIndexableFieldType(value.type)) throw new CmsError('FIELD_NOT_INDEXABLE');
    const columnType = FIELD_TYPE_TO_COLUMN[value.type];
    const column = sql`ALTER TABLE ${sql.ref(name)} ADD COLUMN ${sql.ref(value.slug)} ${sql.raw(columnType)}
      ${value.type === 'blocks' ? sql`NOT NULL DEFAULT '[]'` : value.required ?
        sql`NOT NULL DEFAULT ${sql.raw(formatFieldDefault(value.defaultValue, value.type))}` : sql``}`;
    const searchPlan = value.searchable ? await this.searchOwner.schemaMutationPlan(definition.slug, undefined, current =>
      [...current, { id, slug: value.slug, type: value.type, searchable: true,
        sortOrder: value.sortOrder ?? (fields.length ? Math.max(...fields.map(field => field.sortOrder)) + 1 : 0) }]
        .sort((left, right) => left.sortOrder - right.sortOrder)) : { before: [], after: [] };
    const statements: CompiledQuery[] = [
      ...searchPlan.before,
      sql`INSERT INTO _cms_guards(token, pass) SELECT ${token},
        CASE WHEN EXISTS (SELECT 1 FROM _cms_collections WHERE id = ${definition.id} AND version = ${definition.version})
        AND (SELECT COUNT(*) FROM _cms_fields WHERE collection_id = ${definition.id}) < ${MAX_FIELDS}
        THEN 1 ELSE 0 END`.compile(db),
      ...(isStoragelessField(value) ? [] : [column.compile(db)]),
      db.insertInto('_cms_fields').values({
        id, collection_id: definition.id, slug: value.slug, label: value.label, type: value.type, column_type: columnType,
        required: value.required ? 1 : 0, unique: value.unique ? 1 : 0,
        default_value: value.defaultValue === undefined ? null : JSON.stringify(value.defaultValue),
        validation: value.validation === undefined ? null : JSON.stringify(value.validation),
        sort_order: value.sortOrder ?? (fields.length ? Math.max(...fields.map(field => field.sortOrder))+1 : 0), created_at: new Date().toISOString(),
        ...(value.widget === undefined ? {} : {widget:value.widget}), ...(value.options === undefined ? {} : {options:JSON.stringify(value.options)}),
        searchable: Number(value.searchable === true),
        ...(value.indexed === undefined ? {} : {indexed:Number(value.indexed)}),
        ...(value.translatable === undefined ? {} : {translatable:Number(value.translatable)})
      }).compile(),
      db.updateTable('_cms_collections').set({ version: definition.version + 1, updated_at: new Date().toISOString() }).where('id', '=', definition.id).compile()
    ];
    if(value.indexed) statements.push(...this.fieldIndexStatements(definition.slug,id,value.slug));
    statements.push(...searchPlan.after);
    statements.push(sql`DELETE FROM _cms_guards WHERE token = ${token}`.compile(db));
    await this.batch(statements, 'CONFLICT');
    return (await this.getField(definition.slug, value.slug))!;
  }
  private fieldIndexStatements(slug: string, id: string, fieldSlug: string): CompiledQuery[] {
    const name = 'idx_cf_' + id.toLowerCase(); const db = this.database.db; const table = tableName(slug);
    return [sql`CREATE INDEX IF NOT EXISTS ${sql.ref(name)} ON ${sql.ref(table)} ((${sql.ref(fieldSlug)} IS NOT NULL), ${sql.ref(fieldSlug)}, id) WHERE deleted_at IS NULL`.compile(db),
      sql`CREATE INDEX IF NOT EXISTS ${sql.ref(name+'_loc')} ON ${sql.ref(table)} (locale, (${sql.ref(fieldSlug)} IS NOT NULL), ${sql.ref(fieldSlug)}, id) WHERE deleted_at IS NULL`.compile(db)];
  }
  private dropFieldIndexStatements(id: string): CompiledQuery[] {
    const name = 'idx_cf_' + id.toLowerCase(); const db = this.database.db;
    return [sql`DROP INDEX IF EXISTS ${sql.ref(name)}`.compile(db),sql`DROP INDEX IF EXISTS ${sql.ref(name+'_loc')}`.compile(db)];
  }
  async listCollectionsWithFields(): Promise<(Collection & {fields: Field[]})[]> {
    return Promise.all((await this.listCollections()).map(async collection => ({...collection,fields: await this.listFields(collection.id)})));
  }
  async reorderCollections(input: unknown): Promise<void> {
    if(!Array.isArray(input) || new Set(input).size !== input.length) throw new CmsError('VALIDATION_ERROR');
    const slugs = input.map(slug => parse(identifier,slug)); const collections = await this.listCollections();
    if(slugs.some(slug => !collections.some(collection => collection.slug===slug))) throw new CmsError('NOT_FOUND');
    const positions = new Map(slugs.map((slug,index) => [slug,index]));
    const updatedAt = nextMetadataTimestamp(collections);
    await this.database.atomicBatch(collections.map(collection => this.database.db.updateTable('_cms_collections')
      .set({sort_order:positions.get(collection.slug) ?? null, updated_at:updatedAt}).where('id','=',collection.id).compile()));
  }
  async reorderFields(collectionSlug: unknown, input: unknown): Promise<void> {
    if(!Array.isArray(input)) throw new CmsError('VALIDATION_ERROR');
    const definition = await this.getCollection(collectionSlug); if(!definition) throw new CmsError('NOT_FOUND');
    await this.database.atomicBatch(input.map((slug,index) => this.database.db.updateTable('_cms_fields').set({sort_order:index}).where('collection_id','=',definition.id).where('slug','=',parse(identifier,slug)).compile()));
  }
  async deleteField(collectionSlug: unknown, fieldSlug: unknown): Promise<void> {
    const target = await this.getField(collectionSlug,fieldSlug); if(!target) throw new CmsError('NOT_FOUND');
    const definition = await this.getCollection(collectionSlug); if(!definition) throw new CmsError('NOT_FOUND');
    const db = this.database.db;
    const searchPlan = target.searchable ? await this.searchOwner.schemaMutationPlan(definition.slug, undefined,
      fields => fields.filter(item => item.id !== target.id), {
        ...target,
        // The display projection falls back to string for an unknown stored
        // top-level type. Guard the real stored type; a nested unsupported
        // repeater child still has the actual top-level type repeater.
        type: target.unsupportedType?.path === 'type' ? target.unsupportedType.type : target.type
      }) : { before: [], after: [] };
    await this.batch([
      ...searchPlan.before,
      db.deleteFrom('_cms_fields').where('id','=',target.id).compile(),
      db.updateTable('_cms_collections').set({title_field:sql`CASE WHEN title_field = ${target.slug} THEN NULL ELSE title_field END`, date_field:sql`CASE WHEN date_field = ${target.slug} THEN NULL ELSE date_field END`, updated_at:nextMetadataTimestamp([definition])})
        .where('id','=',target.collectionId).where(eb => eb.or([eb('title_field','=',target.slug),eb('date_field','=',target.slug)])).compile(),
      ...searchPlan.after, ...this.dropFieldIndexStatements(target.id),
      ...(isStoragelessField({type:target.type,validation:target.validation??undefined}) ? [] : [sql`ALTER TABLE ${sql.ref(tableName(collectionSlug))} DROP COLUMN ${sql.ref(target.slug)}`.compile(db)])
    ], 'CONFLICT');
  }
  async deleteCollection(slug: unknown, options?: {force?:boolean}): Promise<void> {
    const target = await this.getCollection(slug); if(!target) throw new CmsError('NOT_FOUND');
    const db = this.database.db;
    const token = ulid();
    await this.batch([
      ...(options?.force ? [] : [sql`INSERT INTO _cms_guards(token,pass) SELECT ${token}, CASE WHEN NOT EXISTS (SELECT 1 FROM ${sql.ref(tableName(slug))} WHERE deleted_at IS NULL) THEN 1 ELSE 0 END`.compile(db)]),
      ...this.searchOwner.dropStatements(target.slug),
      sql`DROP TABLE ${sql.ref(tableName(slug))}`.compile(db),db.deleteFrom('_cms_fields').where('collection_id','=',target.id).compile(),
      db.deleteFrom('_cms_collections').where('id','=',target.id).compile(), sql`DELETE FROM _cms_guards WHERE token = ${token}`.compile(db)
    ],'COLLECTION_NOT_EMPTY');
  }
  private async batch(statements: CompiledQuery[], guardCode: 'LIMIT_EXCEEDED' | 'CONFLICT' | 'COLLECTION_NOT_EMPTY') {
    try { return await this.database.atomicBatch(statements); }
    catch (cause) {
      if (sqliteErrorMessage(cause)?.includes(bylineIndexPrerequisiteChanged)) throw new CmsError('MIGRATION_REQUIRED');
      // Only the deliberate SQL guard's CHECK failure becomes a domain conflict.
      if (cause instanceof Error && /CHECK constraint failed: pass = 1/.test(cause.message)) throw new CmsError(guardCode);
      throw cause;
    }
  }
}
export { fieldMax };

// Preserve the local metadata CAS guarantee for same-millisecond/backward clocks.
// Reorder uses one timestamp for exactly the records the pinned operation touches.
function nextMetadataTimestamp(collections: Pick<Collection, 'updatedAt'>[]): string {
  return new Date(Math.max(Date.now(), ...collections.map(collection => Date.parse(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(collection.updatedAt)
    ? collection.updatedAt.replace(' ', 'T') + 'Z' : collection.updatedAt) + 1))).toISOString();
}

const collectionMetadataColumns = {icon:'icon',hasSeo:'has_seo',titleField:'title_field',dateField:'date_field',urlPattern:'url_pattern',routable:'routable',hidden:'hidden',sortOrder:'sort_order',group:'nav_group',commentsEnabled:'comments_enabled',commentsModeration:'comments_moderation',commentsClosedAfterDays:'comments_closed_after_days',commentsAutoApproveUsers:'comments_auto_approve_users',editLocking:'edit_locking'};
function formatFieldDefault(value: unknown, type: keyof typeof FIELD_TYPE_TO_COLUMN): string {
  const column = FIELD_TYPE_TO_COLUMN[type];
  if(value === undefined) return column === 'INTEGER' ? '0' : column === 'REAL' ? '0.0' : column === 'JSON' ? "'null'" : "''";
  if(value === null) return 'NULL';
  if(column === 'INTEGER' || column === 'REAL') {const number = Number(value); return Number.isFinite(number) ? String(column === 'INTEGER' ? Math.trunc(number) : number) : '0';}
  const text = column === 'JSON' || typeof value === 'object' ? JSON.stringify(value) : String(value);
  return "'"+text.replaceAll("'","''")+"'";
}
