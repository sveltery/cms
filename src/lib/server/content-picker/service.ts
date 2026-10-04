import { z } from 'zod';
import type { Kysely } from 'kysely';
import { CmsError, type CmsDatabase } from '../database/contract.ts';
import { parse, identifier } from '../database/validation.ts';
import { SchemaRegistry } from '../database/registry.ts';
import { cmsService, type ServerPrincipal } from '../database/service.ts';
import { ContentRepository } from '../database/lifecycle/upstream/database/repositories/content.ts';
import type { Database } from '../database/lifecycle/upstream/database/types.ts';
import type { FindManyOptions } from '../database/lifecycle/upstream/database/repositories/types.ts';
import { isSqlite } from '../database/lifecycle/upstream/database/dialect-helpers.ts';
import { FTSManager } from './fts-manager.ts';
import { LOCALE_CODE_PATTERN } from '../menus/i18n-config.ts';

// Source api/schemas/{common,content}.ts picker inputs. Source's ordinary
// list summary/default locale remotes remain independent from this read boundary.
export const pickerListQuery = z.object({
  cursor: z.string().max(2048).optional(), limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  locale: z.string().regex(LOCALE_CODE_PATTERN).optional(), q: z.string().trim().min(1).max(200).optional(),
  status: z.enum(['draft', 'published', 'archived', 'pending', 'private', 'future', 'all']).optional().transform(status => status === 'all' ? undefined : status)
});

// Complete Source resolveSearchColumns / canUseFtsForListFilter.
// EmDash1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e.
// Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
async function resolveSearchColumns(db: Kysely<Database>, collection: string): Promise<string[]> {
  const row = await db.selectFrom('_cms_collections').select(['id', 'title_field']).where('slug', '=', collection).executeTakeFirst();
  if (!row) return ['slug'];
  const fields = await db.selectFrom('_cms_fields').select(['slug', 'searchable']).where('collection_id', '=', row.id).orderBy('sort_order', 'asc').execute();
  const columns = new Set(['slug']); const fieldSlugs = new Set(fields.map(field => field.slug));
  if (row.title_field && fieldSlugs.has(row.title_field)) columns.add(row.title_field);
  for (const candidate of ['title', 'name']) if (fieldSlugs.has(candidate)) columns.add(candidate);
  for (const field of fields) if (field.searchable === 1) columns.add(field.slug);
  return [...columns];
}
async function canUseFtsForListFilter(db: Kysely<Database>, collection: string, searchColumns: string[]): Promise<boolean> {
  if (!isSqlite(db)) return false;
  const ftsManager = new FTSManager(db); const config = await ftsManager.getSearchConfig(collection);
  if (!config?.enabled) return false;
  const searchable = new Set(await ftsManager.getSearchableFields(collection));
  const covered = searchColumns.every(column => column === 'slug' || searchable.has(column));
  if (!covered) return false;
  return ftsManager.ftsTableExists(collection);
}

/** Read-only request composition. No request DDL, index enable or authentication. */
export function contentPickerService(database: CmsDatabase, principal: ServerPrincipal | null) {
  const identity = principal && typeof principal.id === 'string' && principal.id.length > 0 && principal.id.length <= 128 && Array.isArray(principal.permissions)
    ? { id: principal.id, permissions: [...principal.permissions] } : null;
  const db = database.db as unknown as Kysely<Database>;
  const registry = new SchemaRegistry(database); const repository = new ContentRepository(db);
  function read() { if (!identity) throw new CmsError('UNAUTHENTICATED'); if (!identity.permissions.includes('content:read')) throw new CmsError('FORBIDDEN'); return identity; }
  return {
    async collections() { return cmsService(database, identity).listCollections(); },
    async manifest() { return cmsService(database, identity).getEditorManifest(); },
    async list(collection: string, input: unknown = {}) {
      const actor = read(); const slug = parse(identifier, collection);
      const parsed = pickerListQuery.safeParse(input); if (!parsed.success) throw new CmsError('VALIDATION_ERROR');
      const params = parsed.data; const definition = await registry.getCollection(slug); if (!definition) throw new CmsError('NOT_FOUND');
      const where: NonNullable<FindManyOptions['where']> = {};
      if (params.locale) where.locale = params.locale;
      const status = actor.permissions.includes('content:read_drafts') ? params.status : 'published'; if (status) where.status = status;
      const q = params.q?.trim(); if (q) { where.q = q; where.searchColumns = await resolveSearchColumns(db, slug); where.useFts = await canUseFtsForListFilter(db, slug, where.searchColumns); }
      return repository.findMany(slug, { cursor: params.cursor, limit: params.limit || 50, where: Object.keys(where).length ? where : undefined });
    }
  };
}
