import { sql, type CompiledQuery, type Kysely } from 'kysely';
import { ulid } from 'ulidx';
import type { CmsDatabase } from '../database/contract.ts';
import type { Database } from '../database/lifecycle/upstream/database/types.ts';
import { SchemaRegistry } from '../database/registry.ts';
import { columnExists } from '../database/lifecycle/upstream/database/dialect-helpers.ts';
import { tableName } from '../database/validation.ts';
import { RelationRepository } from './repository.ts';
import { invalidateCollectionCache } from '../menus/object-cache.ts';
import { invalidateSchemaCache } from '../schema/zod-generator.ts';
import type { ApiResult } from '../menus/api-types.ts';
import type { BoundField } from './handlers.ts';

function nextMetadataTimestamp(updatedAt: string) {
  const stored = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(updatedAt) ? updatedAt.replace(' ', 'T') + 'Z' : updatedAt;
  return new Date(Math.max(Date.now(), Date.parse(stored) + 1)).toISOString();
}

/** Relation-owned planner mirrors actual published registry field removal. */
export async function prepareRelationDeletion(database: CmsDatabase, id: string, bound: BoundField[]) {
  const db = database.db as unknown as Kysely<Database>;
  const repo = new RelationRepository(database), relation = await repo.findById(id);
  if (!relation) return null;
  const registry = new SchemaRegistry(database);
  const token = `relation-delete:${ulid()}`;
  const statements: CompiledQuery[] = [sql`INSERT INTO _cms_guards(token, pass) SELECT ${token}, CASE WHEN EXISTS
    (SELECT 1 FROM _cms_relations WHERE id = ${id} AND slug = ${relation.slug}) THEN 1 ELSE 0 END`.compile(db)];
  const deletedFields: string[] = [];
  for (const field of bound) {
    const target = await registry.getField(field.collectionSlug, field.fieldSlug);
    const collection = await registry.getCollection(field.collectionSlug);
    if (!target || !collection) continue;
    const index = 'idx_cf_' + target.id.toLowerCase();
    statements.push(sql`DROP INDEX IF EXISTS ${sql.ref(index)}`.compile(db), sql`DROP INDEX IF EXISTS ${sql.ref(index + '_loc')}`.compile(db));
    // Published legacy conversion binds the field while retaining its TEXT
    // column. Follow the pinned registry's actual catalogue check so both
    // converted and newly storage-less fields are removed correctly.
    if (await columnExists(db, tableName(field.collectionSlug), target.slug)) {
      statements.push(sql`ALTER TABLE ${sql.ref(tableName(field.collectionSlug))} DROP COLUMN ${sql.ref(target.slug)}`.compile(db));
    }
    statements.push(db.deleteFrom('_cms_fields').where('id', '=', target.id).compile(),
      db.updateTable('_cms_collections').set({title_field:sql`CASE WHEN title_field = ${target.slug} THEN NULL ELSE title_field END`,
        date_field:sql`CASE WHEN date_field = ${target.slug} THEN NULL ELSE date_field END`,updated_at:nextMetadataTimestamp(collection.updatedAt)})
        .where('id', '=', collection.id).where(eb=>eb.or([eb('title_field','=',target.slug),eb('date_field','=',target.slug)])).compile());
    deletedFields.push(`${field.collectionSlug}.${field.fieldSlug}`);
  }
  statements.push(db.deleteFrom('_cms_content_references').where('relation_id', '=', id).compile(),
    db.deleteFrom('_cms_relations').where('id', '=', id).returning('id').compile(),sql`DELETE FROM _cms_guards WHERE token = ${token}`.compile(db));
  return {statements,deletedFields,collections:[...new Set(bound.map(field=>field.collectionSlug))],relationDeleteIndex:statements.length-2};
}

export async function deleteRelationWithFields(database: CmsDatabase, id: string, bound: BoundField[]): Promise<ApiResult<{deleted:true;deletedFields:string[]}>> {
  const plan = await prepareRelationDeletion(database, id, bound);
  if (!plan) return {success:false,error:{code:'NOT_FOUND',message:'Relation not found'}};
  const result = await database.atomicBatch(plan.statements);
  if (!result[plan.relationDeleteIndex].rows.length) return {success:false,error:{code:'NOT_FOUND',message:'Relation not found'}};
  for (const collection of plan.collections) { invalidateCollectionCache(collection); invalidateSchemaCache(collection); }
  return {success:true,data:{deleted:true,deletedFields:plan.deletedFields}};
}

/** Schema owner must check its actual collection deletability before calling. */
export async function deleteRelationsForCollection(database: CmsDatabase, slug: string): Promise<ApiResult<{deletedRelations:string[]}>> {
  const repo = new RelationRepository(database);
  const { fieldsBoundToRelation } = await import('./handlers.ts');
  const deletedRelations: string[] = [];
  for (const relation of await repo.findForCollection(slug)) {
    const bound = await fieldsBoundToRelation(database.db as unknown as Kysely<Database>, relation.slug);
    const result = await deleteRelationWithFields(database, relation.id, bound);
    if (!result.success) return result;
    deletedRelations.push(relation.id);
  }
  return {success:true,data:{deletedRelations}};
}
