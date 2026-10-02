// Bounded database descriptor projection adapted from EmDash 1.1.0
// packages/core/src/api/handlers/manifest.ts (913cb1bb). MIT Copyright 2026 Cloudflare Inc.
// See notices/emdash-MIT.txt and docs/session-composition-ports.json.
// Field batching follows schema/registry.ts:418 and utils/chunks.ts at the same pin.
// Local ordering, field caps and error behavior: docs/editor-manifest-batching.md.
import type { CollectionSupport } from '../schema/types.ts';
import { sql } from 'kysely';
import { CmsError, type CmsDatabase, type FieldRow, type ScalarValidation } from '../database/contract.ts';
import { MAX_FIELDS, SchemaRegistry } from '../database/registry.ts';
import type { ServerPrincipal } from '../database/service.ts';

export interface EditorField {
  id: string;
  kind: 'string' | 'richText';
  label: string;
  required: boolean;
  validation?: ScalarValidation;
}
export interface EditorCollection {
  label: string;
  labelSingular: string;
  supports: CollectionSupport[];
  fields: Record<string, EditorField>;
}
export interface EditorManifest { collections: Record<string, EditorCollection> }

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
  // Existing registry caps apply: at most 100 collections and 32 scalar fields each.
  // Retain the pinned builder's inherited-name omission and the local no-read policy
  // for omitted fields; use own keys instead of unsafe prototype lookup in the UI.
  const visible = (await registry.listCollections()).filter(collection => !Object.hasOwn(Object.prototype, collection.slug));
  const byCollection = await manifestFields(database, visible.map(collection => collection.id));
  for (const collection of visible) {
    const fields: Record<string, EditorField> = {};
    for (const field of byCollection.get(collection.id) ?? []) {
      // The registry parses defaults even though this projection omits them.
      // Preserve its malformed-JSON errors, including which collections are parsed.
      if (field.default_value !== null) JSON.parse(field.default_value);
      const validation = field.validation === null ? null : JSON.parse(field.validation);
      fields[field.slug] = {
        id: field.id, kind: field.type === 'text' ? 'richText' : 'string', label: field.label, required: field.required === 1,
        ...(validation ? { validation: {
          ...(validation.minLength === undefined ? {} : { minLength: validation.minLength }),
          ...(validation.maxLength === undefined ? {} : { maxLength: validation.maxLength }),
          ...(validation.pattern === undefined ? {} : { pattern: validation.pattern })
        } } : {})
      };
    }
    collections[collection.slug] = {
      label: collection.label, labelSingular: collection.labelSingular || collection.label,
      supports: [...collection.supports], fields
    };
  }
  return { collections };
}
