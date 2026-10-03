import type { ContentValidationIssue } from '../schema/validate-content.ts';
import type { FieldType, ColumnType, FieldValidation, CollectionSupport, CollectionSource, CollectionAdminConfig, FieldWidgetOptions } from '../schema/types.ts';
import type { AuthIdentityTables } from '../auth/identity-migrations.ts';
import type { AuthTables } from '../auth/schema.ts';
import type { CompiledQuery, Kysely, QueryResult } from 'kysely';

export interface CollectionRow {
  id: string; slug: string; label: string; label_singular: string | null;
  description: string | null; supports: string; source: string;
  version: number; created_at: string; updated_at: string;
  icon?: string | null; admin_config?: string | null; has_seo?: number; title_field?: string | null;
  date_field?: string | null; url_pattern?: string | null; routable?: number; hidden?: number;
  sort_order?: number | null; nav_group?: string | null; comments_enabled?: number;
  comments_moderation?: string; comments_closed_after_days?: number; comments_auto_approve_users?: number; edit_locking?: number;
}
export interface FieldRow {
  id: string; collection_id: string; slug: string; label: string;
  type: FieldType; column_type: ColumnType; required: number;
  unique: number; default_value: string | null; validation: string | null;
  sort_order: number; created_at: string;
  widget?: string | null; options?: string | null; searchable?: number; indexed?: number; translatable?: number;
}
export interface CmsTables extends AuthTables, AuthIdentityTables {
  _cms_collections: CollectionRow;
  _cms_fields: FieldRow;
  _cms_migrations: { version: number };
  _cms_guards: { token: string; pass: number };
}

/**
 * Server-only adapter seam. SQL is compiled by Kysely with positional parameters.
 * atomicBatch must commit every statement or roll back every statement, including DDL.
 * Node SQLite and the bounded raw-binding D1 adapter prove this on real local storage.
 * There is deliberately no callback-transaction fallback or non-atomic mode.
 */
export interface CmsDatabase {
  readonly db: Kysely<CmsTables>;
  atomicBatch(statements: readonly CompiledQuery[]): Promise<readonly QueryResult<unknown>[]>;
  close(): Promise<void>;
}
export type DatabaseErrorCode = 'UNAUTHENTICATED' | 'FORBIDDEN' | 'VALIDATION_ERROR'
  | 'INVALID_CURSOR' | 'NOT_FOUND' | 'CONFLICT' | 'COLLECTION_EXISTS' | 'COLLECTION_TABLE_ORPHANED'
  | 'FIELD_EXISTS' | 'FIELD_TYPE_COLUMN_CHANGE' | 'FIELD_TYPE_CHANGE_REQUIRES_MIGRATION' | 'FIELD_UPDATE_REQUIRES_MIGRATION' | 'FIELD_NOT_INDEXABLE' | 'COLLECTION_NOT_EMPTY' | 'UNSUPPORTED_FIELD_TYPE' | 'INVALID_TITLE_FIELD' | 'INVALID_DATE_FIELD' | 'RESERVED_SLUG' | 'LIMIT_EXCEEDED' | 'MIGRATION_REQUIRED';
export class CmsError extends Error {
  readonly code: DatabaseErrorCode;
  readonly details?: {issues:ContentValidationIssue[]};
  constructor(code: DatabaseErrorCode, message:string=code, details?:{issues:ContentValidationIssue[]}) { super(message); this.name='CmsError'; this.code=code; this.details=details; }
}
export interface Collection {
  id: string; slug: string; label: string; labelSingular: string | null;
  description: string | null; supports: CollectionSupport[];
  source: CollectionSource; version: number; createdAt: string; updatedAt: string;
  icon?: string; admin?: CollectionAdminConfig; hasSeo: boolean; titleField?: string; dateField?: string;
  urlPattern?: string; routable: boolean; hidden: boolean; sortOrder?: number; group?: string;
  commentsEnabled: boolean; commentsModeration: 'all'|'first_time'|'none'; commentsClosedAfterDays: number;
  commentsAutoApproveUsers: boolean; editLocking: boolean;
}
export type ScalarValidation = Pick<FieldValidation, 'minLength'|'maxLength'|'pattern'>;
export interface Field {
  id: string; collectionId: string; slug: string; label: string;
  type: FieldType; columnType: ColumnType; required: boolean; unique: boolean;
  defaultValue?: unknown; validation: FieldValidation | null;
  widget?: string; options?: FieldWidgetOptions; searchable: boolean; indexed: boolean; translatable: boolean;
  unsupportedType?: {type: string; path: string};
  sortOrder: number; createdAt: string;
}
export interface DraftEntry {
  id: string; type: string; slug: string | null; status: string; authorId: string | null;
  locale: string; version: number; createdAt: string; updatedAt: string;
  publishedAt?: string | null; scheduledAt?: string | null;
  liveRevisionId?: string | null; draftRevisionId?: string | null;
  translationGroup?: string | null; liveData?: Record<string, unknown> | null;
  data: Record<string, unknown>;
}
export interface DraftSummary extends Omit<DraftEntry, 'data'> { title: string | null }
export interface TrashedDraftEntry extends DraftEntry { deletedAt: string }
export interface TrashedDraftSummary extends DraftSummary { deletedAt: string }
export interface RevisionPrecondition { version: number; updatedAt: string }
export interface Page<T> { items: T[]; nextCursor?: string }
