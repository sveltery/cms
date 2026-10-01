import type { CompiledQuery, Kysely, QueryResult } from 'kysely';

export interface CollectionRow {
  id: string; slug: string; label: string; label_singular: string | null;
  description: string | null; supports: string; source: string;
  version: number; created_at: string; updated_at: string;
}
export interface FieldRow {
  id: string; collection_id: string; slug: string; label: string;
  type: 'string' | 'text'; column_type: 'TEXT'; required: number;
  unique: number; default_value: string | null; validation: string | null;
  sort_order: number; created_at: string;
}
export interface CmsTables {
  _cms_collections: CollectionRow;
  _cms_fields: FieldRow;
  _cms_migrations: { version: number };
  _cms_guards: { token: string; pass: number };
}

/**
 * Server-only adapter seam. SQL is compiled by Kysely with positional parameters.
 * atomicBatch must commit every statement or roll back every statement, including DDL.
 * A future D1 implementation must prove that guarantee on the real binding first.
 * There is deliberately no callback-transaction fallback or non-atomic mode.
 */
export interface CmsDatabase {
  readonly db: Kysely<CmsTables>;
  atomicBatch(statements: readonly CompiledQuery[]): Promise<readonly QueryResult<unknown>[]>;
  close(): Promise<void>;
}
export type DatabaseErrorCode = 'UNAUTHENTICATED' | 'FORBIDDEN' | 'VALIDATION_ERROR'
  | 'NOT_FOUND' | 'CONFLICT' | 'COLLECTION_EXISTS' | 'COLLECTION_TABLE_ORPHANED'
  | 'FIELD_EXISTS' | 'RESERVED_SLUG' | 'LIMIT_EXCEEDED' | 'MIGRATION_REQUIRED';
export class CmsError extends Error {
  readonly code: DatabaseErrorCode;
  constructor(code: DatabaseErrorCode) { super(code); this.name = 'CmsError'; this.code = code; }
}
export interface Collection {
  id: string; slug: string; label: string; labelSingular: string | null;
  description: string | null; supports: ('drafts' | 'revisions')[];
  source: 'manual'; version: number; createdAt: string; updatedAt: string;
}
export interface Field {
  id: string; collectionId: string; slug: string; label: string;
  type: 'string' | 'text'; columnType: 'TEXT'; required: boolean; unique: boolean;
  defaultValue?: string; validation: { minLength?: number; maxLength?: number } | null;
  sortOrder: number; createdAt: string;
}
export interface DraftEntry {
  id: string; type: string; slug: string | null; status: 'draft'; authorId: string | null;
  locale: string; version: number; createdAt: string; updatedAt: string;
  data: Record<string, string | null>;
}
export interface DraftSummary extends Omit<DraftEntry, 'data'> { title: string | null }
export interface RevisionPrecondition { version: number; updatedAt: string }
export interface Page<T> { items: T[]; nextCursor?: string }
