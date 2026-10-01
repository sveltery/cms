// Bounded database descriptor projection adapted from EmDash 1.1.0
// packages/core/src/api/handlers/manifest.ts (913cb1bb). MIT Copyright 2026 Cloudflare Inc.
// See notices/emdash-MIT.txt and docs/session-composition-ports.json.
import { CmsError, type CmsDatabase } from '../database/contract.ts';
import { SchemaRegistry } from '../database/registry.ts';
import type { ServerPrincipal } from '../database/service.ts';

export interface EditorField {
  id: string;
  kind: 'string' | 'richText';
  label: string;
  required: boolean;
  validation?: { minLength?: number; maxLength?: number };
}
export interface EditorCollection {
  label: string;
  labelSingular: string;
  supports: ('drafts' | 'revisions')[];
  fields: Record<string, EditorField>;
}
export interface EditorManifest { collections: Record<string, EditorCollection> }

/** Fresh, bounded editing metadata. No administrative schema permission is granted. */
export async function editorManifest(database: CmsDatabase, principal: ServerPrincipal | null): Promise<EditorManifest> {
  if (!principal || typeof principal.id !== 'string' || !principal.id.length || principal.id.length > 128) throw new CmsError('UNAUTHENTICATED');
  if (!principal.permissions.includes('content:read') || !principal.permissions.includes('content:read_drafts')) throw new CmsError('FORBIDDEN');
  const registry = new SchemaRegistry(database);
  const collections: Record<string, EditorCollection> = {};
  // Existing registry caps apply: at most 100 collections and 32 scalar fields each.
  for (const collection of await registry.listCollections()) {
    const fields: Record<string, EditorField> = {};
    for (const field of await registry.listFields(collection.id)) {
      fields[field.slug] = {
        id: field.id, kind: field.type === 'text' ? 'richText' : 'string', label: field.label, required: field.required,
        ...(field.validation ? { validation: {
          ...(field.validation.minLength === undefined ? {} : { minLength: field.validation.minLength }),
          ...(field.validation.maxLength === undefined ? {} : { maxLength: field.validation.maxLength })
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
