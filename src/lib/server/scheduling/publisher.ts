// EmDash1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e:
// packages/core/src/api/handlers/content.ts handleContentPublish repository fence.
// Copyright2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
import type { Kysely } from 'kysely';
import { CmsError } from '../database/contract.ts';
import { ContentRepository } from '../database/lifecycle/upstream/database/repositories/content.ts';
import { ContentMutationConflictError, EmDashValidationError, ScheduledNotDueError,
  type ContentItem } from '../database/lifecycle/upstream/database/repositories/types.ts';
import { encodeRev } from '../database/lifecycle/upstream/api/rev.ts';
import { publicationStatementExecutor } from '../redirects/publication-atomic.ts';
import { completeContentSlugRedirect } from '../redirects/content-atomic.ts';
import type { ApiResult } from '../menus/api-types.ts';
import { schedulingStorage, SchemaRegistry } from './storage.ts';

/**
 * Trusted maintenance publisher using the sole published content repository.
 * Request authorization belongs to the existing service. Reference promotion,
 * SEO hydration, configured plugins and media activation remain unimplemented.
 */
export async function handleContentPublish(db: Kysely<any>, collection: string, id: string, options: {
  publishedAt?: string;
  requireScheduledDue?: boolean;
  expectedScheduledAt?: string;
  currentTime?: Date;
} = {}): Promise<ApiResult<{item: ContentItem; _rev: string}>> {
  try {
    const database = schedulingStorage(db);
    const definition = await new SchemaRegistry(db).getCollectionWithFields(collection);
    if (!definition) return {success: false, error: {code: 'COLLECTION_NOT_FOUND', message: `Collection '${collection}' not found`}};
    const repo = new ContentRepository(db);
    const existing = await repo.findByIdOrSlug(collection, id);
    const resolvedId = existing?.id ?? id;
    let redirectCreated = false;
    const executePublication = publicationStatementExecutor(database, {
      id: definition.id, slug: collection, version: definition.version, urlPattern: definition.urlPattern ?? null
    }, candidate => { redirectCreated = candidate; });
    const item = await repo.publish(collection, resolvedId, options.publishedAt,
      options.requireScheduledDue, options.expectedScheduledAt,
      definition.supports.includes('revisions'), definition.routable,
      undefined, options.currentTime, executePublication);
    if (redirectCreated) completeContentSlugRedirect(database);
    return {success: true, data: {item, _rev: encodeRev(item)}};
  } catch (error) {
    if (error instanceof ScheduledNotDueError) return {success: false, error: {code: 'NOT_DUE', message: error.message}};
    if (error instanceof ContentMutationConflictError || error instanceof CmsError && error.code === 'CONFLICT')
      return {success: false, error: {code: 'CONFLICT', message: error.message}};
    if (error instanceof EmDashValidationError) return {success: false, error: {code: 'VALIDATION_ERROR', message: error.message}};
    console.error('Content publish error:', error);
    return {success: false, error: {code: 'CONTENT_PUBLISH_ERROR', message: 'Failed to publish content'}};
  }
}
