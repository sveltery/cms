// Bounded database descriptor projection adapted from EmDash 1.1.0
// packages/core/src/api/handlers/manifest.ts (913cb1bb). MIT Copyright 2026 Cloudflare Inc.
// See notices/emdash-MIT.txt and docs/session-composition-ports.json.
// Field batching follows schema/registry.ts:418 and utils/chunks.ts at the same pin.
// Local ordering, field caps and error behavior: docs/editor-manifest-batching.md.
import { MAX_COLLECTION_LIST_COLUMNS, type CollectionSupport, type FieldType, type FieldValidation, type FieldWidgetOptions, type UnsupportedFieldType } from '../schema/types.ts';
import { sql } from 'kysely';
import { CmsError, type CmsDatabase, type Field, type FieldRow } from '../database/contract.ts';
import { MAX_FIELDS, SchemaRegistry, fieldFromRow } from '../database/registry.ts';
import type { ServerPrincipal } from '../database/service.ts';

export interface EditorField {
  id: string;
  kind: typeof FIELD_TYPE_TO_KIND[FieldType] | 'unsupported';
  /** Local editor extension: distinguish storage-compatible aliases. */
  type: FieldType;
  label: string;
  required: boolean;
  translatable: boolean;
  unsupportedType?: UnsupportedFieldType;
  widget?: string;
  options?: FieldWidgetOptions | { value: string; label: string }[];
  validation?: FieldValidation;
}
export interface EditorCollection {
  label: string;
  labelSingular: string;
  supports: CollectionSupport[];
  hasSeo: boolean;
  urlPattern?: string;
  routable: boolean;
  titleField?: string;
  dateField?: string;
  hidden?: true;
  icon?: string;
  group?: string;
  quickCreate?: false;
  listColumns?: string[];
  fields: Record<string, EditorField>;
}
export interface EditorManifest { collections: Record<string, EditorCollection> }

// Pinned api/handlers/manifest.ts:51 and :349. Text is a legacy richText
// string; portableText is an array and has its own editor kind.
const FIELD_TYPE_TO_KIND = {
  string: 'string', slug: 'string', url: 'url', text: 'richText', number: 'number', integer: 'number',
  boolean: 'boolean', datetime: 'datetime', select: 'select', multiSelect: 'multiSelect',
  portableText: 'portableText', image: 'image', file: 'file', reference: 'reference', json: 'json',
  repeater: 'repeater', blocks: 'blocks'
} as const satisfies Record<FieldType, string>;
const LIST_COLUMN_FIELD_TYPES: ReadonlySet<FieldType> = new Set(['string', 'number', 'integer', 'boolean', 'datetime', 'select', 'multiSelect']);
// Intentional least-disclosure projection: all declared pinned keys, while
// retaining the established omission of unrecognized raw validation metadata.
const VALIDATION_KEYS = ['required', 'min', 'max', 'minLength', 'maxLength', 'pattern', 'options', 'subFields',
  'minItems', 'maxItems', 'allowedMimeTypes', 'relation', 'relationSide', 'targetCollection', 'multiple',
  'allowedTypes', 'retiredTypes'] as const satisfies readonly (keyof FieldValidation)[];
function descriptor(field: Field): EditorField {
  const entry: EditorField = {
    id: field.id, type: field.type, kind: field.unsupportedType ? 'unsupported' : FIELD_TYPE_TO_KIND[field.type],
    label: field.label, required: field.required, translatable: field.translatable
  };
  if (field.unsupportedType) entry.unsupportedType = field.unsupportedType;
  if (field.widget) entry.widget = field.widget;
  if (field.options) entry.options = field.options;
  if (field.validation?.options) entry.options = field.validation.options.map(value => ({
    value, label: value.charAt(0).toUpperCase() + value.slice(1)
  }));
  if (field.validation) entry.validation = Object.fromEntries(VALIDATION_KEYS
    .filter(key => Object.hasOwn(field.validation!, key)).map(key => [key, field.validation![key]]));
  return entry;
}

// Pinned SQL_BATCH_SIZE. Each query also binds the existing per-collection cap.
const FIELD_COLLECTION_BATCH_SIZE = 50;

async function manifestFields(database: CmsDatabase, collectionIds: string[]): Promise<Map<string, FieldRow[]>> {
  const byCollection = new Map<string, FieldRow[]>();
  for (let offset = 0; offset < collectionIds.length; offset += FIELD_COLLECTION_BATCH_SIZE) {
    // Rank before limiting: a global LIMIT would starve later collections.
    // Keep the registry's sort_order/id order and 32-field cap inside SQL.
    const ranked = database.db.selectFrom('_cms_fields').selectAll()
      .select(sql<number>`row_number() over (partition by collection_id order by sort_order, id)`.as('field_rank'))
      .where('collection_id', 'in', collectionIds.slice(offset, offset + FIELD_COLLECTION_BATCH_SIZE)).as('ranked_fields');
    const rows = await database.db.selectFrom(ranked).selectAll().where('field_rank', '<=', MAX_FIELDS)
      .orderBy('collection_id').orderBy('sort_order').orderBy('id').execute();
    for (const row of rows) {
      const fields = byCollection.get(row.collection_id) ?? [];
      fields.push(row);
      byCollection.set(row.collection_id, fields);
    }
  }
  return byCollection;
}

/** Fresh, bounded editing metadata. No administrative schema permission is granted. */
export async function editorManifest(database: CmsDatabase, principal: ServerPrincipal | null): Promise<EditorManifest> {
  if (!principal || typeof principal.id !== 'string' || !principal.id.length || principal.id.length > 128) throw new CmsError('UNAUTHENTICATED');
  if (!principal.permissions.includes('content:read') || !principal.permissions.includes('content:read_drafts')) throw new CmsError('FORBIDDEN');
  const registry = new SchemaRegistry(database);
  const collections: Record<string, EditorCollection> = {};
  // Existing registry caps apply: at most 100 collections and 32 fields each.
  // Retain the pinned builder's inherited-name omission and the local no-read policy
  // for omitted fields; use own keys instead of unsafe prototype lookup in the UI.
  const visible = (await registry.listCollections()).filter(collection => !Object.hasOwn(Object.prototype, collection.slug));
  const byCollection = await manifestFields(database, visible.map(collection => collection.id));
  for (const collection of visible) {
    const fields: Record<string, EditorField> = {};
    const decoded = (byCollection.get(collection.id) ?? []).map(fieldFromRow);
    for (const field of decoded) fields[field.slug] = descriptor(field);
    const listColumns: string[] = [];
    const fieldTypes = new Map(decoded.map(field => [field.slug, field.type]));
    for (const slug of collection.admin?.listColumns ?? []) {
      if (listColumns.includes(slug)) continue;
      const type = fieldTypes.get(slug);
      if (!type || !LIST_COLUMN_FIELD_TYPES.has(type)) {
        console.warn(`EmDash: Ignoring unsupported or unknown list column "${slug}" in collection "${collection.slug}".`);
        continue;
      }
      if (listColumns.length >= MAX_COLLECTION_LIST_COLUMNS) {
        console.warn(`EmDash: Collection "${collection.slug}" declares more than ${MAX_COLLECTION_LIST_COLUMNS} list columns; extra columns are ignored.`);
        break;
      }
      listColumns.push(slug);
    }
    collections[collection.slug] = {
      label: collection.label, labelSingular: collection.labelSingular || collection.label,
      supports: [...collection.supports], hasSeo: collection.hasSeo, urlPattern: collection.urlPattern,
      routable: collection.routable !== false, titleField: collection.titleField, dateField: collection.dateField,
      ...(collection.hidden ? { hidden: true } : {}), ...(collection.icon ? { icon: collection.icon } : {}),
      ...(collection.group ? { group: collection.group } : {}),
      ...(collection.admin?.quickCreate === false ? { quickCreate: false } : {}),
      listColumns: listColumns.length ? listColumns : undefined, fields
    };
  }
  return { collections };
}
