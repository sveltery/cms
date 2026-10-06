import { sql, type CompiledQuery, type Kysely } from 'kysely';
import { ulid } from 'ulidx';
import type { CmsDatabase } from '../database/contract.ts';
import type { Database } from '../database/lifecycle/upstream/database/types.ts';
import { chunks } from '../database/lifecycle/upstream/utils/chunks.ts';
import type { RelationRepository, Relation } from './repository.ts';

type Edge = { id: string; relation_id: string; parent_group: string; child_group: string; sort_order: number; created_at: string };
type Side = 'parent' | 'child';
const INSERT_BATCH = 16; // six bound values per edge, <=100 per statement.
const REPOSITION_BATCH = 50; // an id twice; order is a validated integer literal.

function dbFor(database: CmsDatabase) { return database.db as unknown as Kysely<Database>; }
async function relationFor(repo: RelationRepository, key: string): Promise<Relation | null> {
  return await repo.findById(key) ?? await repo.findBySlug(key);
}
export function relationGuard(db: Kysely<Database>, relation: Relation, token: string): CompiledQuery {
  return sql`INSERT INTO _cms_guards(token, pass) SELECT ${token}, CASE WHEN EXISTS
    (SELECT 1 FROM _cms_relations WHERE id IS ${relation.id} AND slug IS ${relation.slug}
      AND parent_collection IS ${relation.parentCollection} AND child_collection IS ${relation.childCollection}
      AND max_children_per_parent IS ${relation.maxChildrenPerParent}
      AND max_parents_per_child IS ${relation.maxParentsPerChild}) THEN 1 ELSE 0 END`.compile(db);
}
export function addPlan(db: Kysely<Database>, rows: Edge[], limitedSide: Side, limit: number | null, token: string): CompiledQuery[] {
  if (limit === null) return [...chunks(rows, INSERT_BATCH)].map(batch => db.insertInto('_cms_content_references').values(batch).onConflict(oc => oc.doNothing()).compile());
  const column = limitedSide === 'parent' ? 'parent_group' : 'child_group';
  return rows.flatMap(row => [
    sql`UPDATE _cms_guards SET pass = CASE WHEN
      (SELECT COUNT(*) FROM _cms_content_references WHERE relation_id = ${row.relation_id}
       AND ${sql.ref(column)} = ${row[column]}) < ${limit} THEN 1 ELSE 0 END
      WHERE token = ${token}`.compile(db),
    db.insertInto('_cms_content_references').values(row).compile()
  ]);
}
export function removePlan(db: Kysely<Database>, ids: string[]): CompiledQuery[] {
  return [...chunks(ids, 100)].map(batch => db.deleteFrom('_cms_content_references').where('id', 'in', batch).compile());
}
export function positionPlan(db: Kysely<Database>, moves: {id: string; sortOrder: number}[]): CompiledQuery[] {
  return [...chunks(moves, REPOSITION_BATCH)].map(batch => {
    for (const move of batch) if (!Number.isInteger(move.sortOrder) || move.sortOrder < 0) throw new TypeError(`Invalid reference sort order: ${move.sortOrder}`);
    return db.updateTable('_cms_content_references').set({ sort_order: sql<number>`CASE ${sql.ref('id')}
      ${sql.join(batch.map(move => sql`WHEN ${move.id} THEN ${sql.lit(move.sortOrder)}`), sql` `)} END` })
      .where('id', 'in', batch.map(move => move.id)).compile();
  });
}
async function executeSelection(database: CmsDatabase, relation: Relation, additions: Edge[], limitedSide: Side,
  limit: number | null, token: string, statements: CompiledQuery[]): Promise<string[]> {
  try { await database.atomicBatch(statements); return []; }
  catch (cause) {
    // Only the actual cardinality guard failure can return a refused group.
    // Unexpected storage errors and a changed/missing relation remain errors.
    if (limit === null || !(cause instanceof Error) || !/CHECK constraint failed:\s*pass\s*=\s*1/.test(cause.message)) throw cause;
    const db = dbFor(database);
    const current = await db.selectFrom('_cms_relations').selectAll().where('id', '=', relation.id).executeTakeFirst();
    if (!current || current.max_children_per_parent !== relation.maxChildrenPerParent || current.max_parents_per_child !== relation.maxParentsPerChild) throw cause;
    const column = limitedSide === 'parent' ? 'parent_group' : 'child_group';
    for (const row of additions) {
      const count = await db.selectFrom('_cms_content_references').select(eb => eb.fn.countAll<number>().as('count'))
        .where('relation_id', '=', relation.id).where(column, '=', row[column]).executeTakeFirstOrThrow();
      if (Number(count.count) >= limit) return [row[column]];
    }
    // A changed transient state does not permit manufacturing a refusal.
    throw cause;
  }
}

/** Canonical fixed batches retain Source ordering/limits and native C-07. */
async function executePreparedSelection(database:CmsDatabase,repo:RelationRepository,key:string,entryGroup:string,groups:string[],side:'parent'|'child'):Promise<string[]>{
  const relation=await relationFor(repo,key);if(!relation)return[];
  const {prepareContentReferenceSelection}=await import('./content-plan.ts');
  const prepared=await prepareContentReferenceSelection(database,{relation:relation.id,side,entryGroup,groups});
  return executeSelection(database,prepared.relation,prepared.additions,prepared.limitedSide,prepared.limit,prepared.token,
    [...prepared.plan.before,...prepared.plan.after,...prepared.plan.cleanup]);
}
/** Standalone operations use the same ordered preparation as content composition. */
export async function atomicSetChildren(database:CmsDatabase,repo:RelationRepository,key:string,parent:string,groups:string[]):Promise<string[]>{
  return executePreparedSelection(database,repo,key,parent,groups,'parent');
}
export async function atomicSetParents(database:CmsDatabase,repo:RelationRepository,key:string,child:string,groups:string[]):Promise<string[]>{
  return executePreparedSelection(database,repo,key,child,groups,'child');
}

export async function atomicDeleteRelation(database: CmsDatabase, repo: RelationRepository, id: string): Promise<boolean> {
  const relation = await repo.findById(id); if (!relation) return false;
  const db = dbFor(database);
  const results = await database.atomicBatch([db.deleteFrom('_cms_content_references').where('relation_id', '=', id).compile(),
    db.deleteFrom('_cms_relations').where('id', '=', id).compile()]);
  return (results[1].numAffectedRows ?? 0n) > 0n;
}

/** A duplicated selection spans relations, so all relation plans commit together. */
export async function atomicCopyParentEdges(database: CmsDatabase, repo: RelationRepository, from: string, to: string): Promise<string[]> {
  const db = dbFor(database);
  const original = await db.selectFrom('_cms_content_references').selectAll().where('parent_group', '=', from).execute();
  if (!original.length) return [];
  const grouped = new Map<string, Edge[]>();
  const now = new Date().toISOString();
  for (const row of original) {
    const rows = grouped.get(row.relation_id) ?? [];
    rows.push({...row,id:ulid(),parent_group:to,created_at:now});
    grouped.set(row.relation_id,rows);
  }
  const plans: {relation:Relation;rows:Edge[]}[] = [];
  const statements: CompiledQuery[] = [];
  for (const [id,rows] of grouped) {
    const relation = await repo.findById(id);
    if (!relation) throw new Error('Reference relation no longer exists');
    const token = `relation-copy:${ulid()}`;
    plans.push({relation,rows});
    statements.push(relationGuard(db,relation,token),...addPlan(db,rows,'child',relation.maxParentsPerChild,token),
      sql`DELETE FROM _cms_guards WHERE token = ${token}`.compile(db));
  }
  try { await database.atomicBatch(statements); return []; }
  catch (cause) {
    if (!(cause instanceof Error) || !/CHECK constraint failed:\s*pass\s*=\s*1/.test(cause.message)) throw cause;
    // Validate actual current definitions before identifying an actual refused
    // child. A definition change is a failed operation, not a fabricated refusal.
    for (const {relation} of plans) {
      const current = await repo.findById(relation.id);
      if (!current || current.slug !== relation.slug || current.parentCollection !== relation.parentCollection
        || current.childCollection !== relation.childCollection || current.maxChildrenPerParent !== relation.maxChildrenPerParent
        || current.maxParentsPerChild !== relation.maxParentsPerChild) throw cause;
    }
    for (const {relation,rows} of plans) {
      if (relation.maxParentsPerChild === null) continue;
      for (const row of rows) {
        const count = await repo.countParents(relation.id,row.child_group);
        if (count >= relation.maxParentsPerChild) return [row.child_group];
      }
    }
    throw cause;
  }
}
