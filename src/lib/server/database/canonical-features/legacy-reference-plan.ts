// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// Native atomic-plan adaptation of WHOLE Source087 at immutable
// 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e. Its authority remains byte-exact
// in parity/emdash/canonical-feature-storage-source; this is not its runner.
import { sql, type CompiledQuery, type RawBuilder } from 'kysely';
import { ulid } from 'ulidx';
import { CmsError, type CmsDatabase } from '../contract.ts';

interface FieldRow {
  field_id: string; field_slug: string; field_label: string;
  validation: string | null; options: string | null;
  indexed: number | null; searchable: number | null;
  collection_slug: string; collection_label: string; collection_label_singular: string | null;
}
interface LegacyField extends FieldRow {
  parsedValidation: Record<string, unknown>; targetCollection: string; allowMultiple: boolean;
}
export interface LegacyReferencePlan {
  /** Every guard executes before ANY pending migration DDL or write. */
  readonly guards: readonly CompiledQuery[];
  readonly statements: readonly CompiledQuery[];
}
export const legacyReferencePrerequisiteChanged = 'sveltery-cms-legacy-reference-prerequisite-changed';

function parseObject(value: string | null): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    return typeof parsed === 'object' && parsed !== null ? parsed as Record<string, unknown> : {};
  } catch { return {}; }
}
function readString(value: Record<string, unknown>, key: string) {
  return typeof value[key] === 'string' && value[key].length > 0 ? value[key] : undefined;
}
function columnIds(value: unknown): string[] {
  if (typeof value !== 'string' || value.length === 0) return [];
  if (!value.startsWith('[')) return [value];
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { return [value]; }
  return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0) : [];
}
function safeIdentifier(value: string) {
  // Source validateIdentifier's SQL identifier contract, including its 128 limit.
  if (!value || value.length > 128 || !/^[a-z][a-z0-9_]*$/.test(value)) throw new CmsError('MIGRATION_REQUIRED');
  return value;
}

/**
 * Reads the real old installation without writing or simulating future tables.
 * SQLite itself encodes each actual SELECT, and an equivalent guard compares
 * those same rows inside the final atomic batch. Presence is separately guarded.
 * A genuinely absent relation table means the pending CREATE starts empty; it
 * never causes a database adapter to return an invented successful query result.
 */
export async function planLegacyReferenceConversion(database: CmsDatabase): Promise<LegacyReferencePlan> {
  const guards: CompiledQuery[] = [], statements: CompiledQuery[] = [];
  async function snapshot<T>(query: RawBuilder<T>, keys: readonly (keyof T & string)[]): Promise<T[]> {
    const pairs = keys.flatMap(key => [sql`${key}`, sql.ref(key)]);
    const encoded = sql<{ snapshot: string }>`SELECT json_group_array(json_object(${sql.join(pairs)})) AS snapshot FROM (${query})`;
    const receipt = (await encoded.execute(database.db)).rows[0]?.snapshot;
    if (typeof receipt !== 'string') throw new CmsError('MIGRATION_REQUIRED');
    guards.push(sql`SELECT json_extract('[]', CASE WHEN (${encoded}) = ${receipt}
      THEN '$' ELSE ${legacyReferencePrerequisiteChanged} END)`.compile(database.db));
    return JSON.parse(receipt) as T[];
  }
  const names = ['_cms_fields', '_cms_collections', '_cms_relations', '_cms_content_references'];
  const catalogue = await snapshot(sql<{ name: string; type: string; sql: string | null }>`
    SELECT name,type,sql FROM sqlite_master WHERE name IN (${sql.join(names)}) AND type <> 'trigger' ORDER BY name,type`,
    ['name', 'type', 'sql']);
  const tables = new Set(catalogue.filter(row => row.type === 'table').map(row => row.name));
  if (catalogue.some(row => row.type !== 'table') ||
    tables.has('_cms_fields') !== tables.has('_cms_collections') ||
    tables.has('_cms_relations') !== tables.has('_cms_content_references')) throw new CmsError('MIGRATION_REQUIRED');
  if (!tables.has('_cms_fields')) {
    if (tables.has('_cms_relations')) throw new CmsError('MIGRATION_REQUIRED');
    return { guards, statements };
  }
  const columns = (await sql<{ name: string }>`PRAGMA table_info(_cms_fields)`.execute(database.db)).rows;
  if (!['options', 'indexed', 'searchable'].every(name => columns.some(column => column.name === name))) {
    // Immutable1–2 permit only string/text fields. Confirm actual stored rows;
    // provider3 will add the new columns later in the same real migration batch.
    const references = await snapshot(sql<{ id: string }>`SELECT id FROM _cms_fields WHERE type='reference' ORDER BY id`, ['id']);
    if (references.length) throw new CmsError('MIGRATION_REQUIRED');
    return { guards, statements };
  }
  const rows = await snapshot(sql<FieldRow>`SELECT f.id AS field_id, f.slug AS field_slug, f.label AS field_label,
    f.validation, f.options, f.indexed, f.searchable, c.slug AS collection_slug,
    c.label AS collection_label, c.label_singular AS collection_label_singular
    FROM _cms_fields AS f INNER JOIN _cms_collections AS c ON c.id=f.collection_id
    WHERE f.type='reference' ORDER BY c.slug,f.slug`,
  ['field_id', 'field_slug', 'field_label', 'validation', 'options', 'indexed', 'searchable',
    'collection_slug', 'collection_label', 'collection_label_singular']);
  const collections = await snapshot(sql<{ slug: string }>`SELECT slug FROM _cms_collections ORDER BY slug`, ['slug']);
  const known = new Set(collections.map(row => row.slug));
  const boundSlugs = new Set<string>(), fields: LegacyField[] = [];
  for (const row of rows) {
    const validation = parseObject(row.validation), bound = readString(validation, 'relation');
    if (bound) { boundSlugs.add(bound); continue; }
    if (row.indexed === 1 || row.searchable === 1) continue;
    const options = parseObject(row.options);
    const targetCollection = readString(options, 'collection') ?? readString(validation, 'targetCollection') ?? readString(validation, 'collection');
    if (!targetCollection || !known.has(targetCollection)) continue;
    fields.push({ ...row, parsedValidation: validation, targetCollection, allowMultiple: options.allowMultiple === true });
  }
  // These are actual existing claims plus explicitly planned INSERT claims.
  // No query is made against absent future storage or given fabricated results.
  const claims = new Map<string, string>();
  if (tables.has('_cms_relations')) {
    const relations = await snapshot(sql<{ id: string; slug: string }>`SELECT id,slug FROM _cms_relations ORDER BY slug,id`, ['id', 'slug']);
    for (const row of relations) claims.set(row.slug, row.id);
  }
  for (const field of fields) {
    const parentTable = safeIdentifier(`ec_${field.collection_slug}`), childTable = safeIdentifier(`ec_${field.targetCollection}`);
    safeIdentifier(field.field_slug);
    const contentTables = await snapshot(sql<{ name: string; sql: string | null }>`SELECT name,sql FROM sqlite_master
      WHERE type='table' AND name IN (${parentTable},${childTable}) ORDER BY name`, ['name', 'sql']);
    const contentNames = new Set(contentTables.map(row => row.name));
    const selections = new Map<string, string[]>();
    if (contentNames.has(parentTable) && contentNames.has(childTable)) {
      const entries = await snapshot(sql<{ translation_group: string | null; value: unknown }>`
        SELECT translation_group,${sql.ref(field.field_slug)} AS value FROM ${sql.ref(parentTable)}
        WHERE ${sql.ref(field.field_slug)} IS NOT NULL ORDER BY locale,id`, ['translation_group', 'value']);
      const parents = entries.flatMap(entry => {
        if (!entry.translation_group) return [];
        const ids = columnIds(entry.value);
        return ids.length ? [{ parentGroup: entry.translation_group, ids }] : [];
      });
      const ids = [...new Set(parents.flatMap(row => row.ids))], children = new Map<string, string>();
      for (let offset = 0; offset < ids.length; offset += 50) {
        const resolved = await snapshot(sql<{ id: string; translation_group: string | null }>`
          SELECT id,translation_group FROM ${sql.ref(childTable)} WHERE id IN (${sql.join(ids.slice(offset, offset + 50))}) ORDER BY id`,
        ['id', 'translation_group']);
        for (const row of resolved) if (row.translation_group) children.set(row.id, row.translation_group);
      }
      let disagreement = false;
      for (const row of parents) {
        const groups: string[] = [];
        for (const id of row.ids) { const group = children.get(id); if (group && !groups.includes(group)) groups.push(group); }
        const existing = selections.get(row.parentGroup);
        if (existing && (existing.length !== groups.length || existing.some((group, index) => group !== groups[index]))) {
          disagreement = true; break;
        }
        selections.set(row.parentGroup, groups);
      }
      if (disagreement) continue;
    }
    const slug = `${field.collection_slug}_${field.field_slug}`.slice(0, 63), relationId = field.field_id;
    const claimed = claims.get(slug), maxChildren = field.allowMultiple ? null : 1;
    if (claimed) { if (claimed !== relationId || boundSlugs.has(slug)) continue; }
    else {
      statements.push(sql`INSERT INTO _cms_relations
        (id,slug,parent_collection,child_collection,parent_label,parent_label_singular,child_label,max_children_per_parent,created_at,updated_at)
        VALUES (${relationId},${slug},${field.collection_slug},${field.targetCollection},${field.collection_label},
          ${field.collection_label_singular},${field.field_label},${maxChildren},datetime('now'),datetime('now'))`.compile(database.db));
      claims.set(slug, relationId);
    }
    const copied = new Map<string, Set<string>>();
    if (selections.size && tables.has('_cms_content_references')) {
      const edges = await snapshot(sql<{ parent_group: string; child_group: string }>`
        SELECT parent_group,child_group FROM _cms_content_references WHERE relation_id=${relationId} ORDER BY parent_group,child_group`,
      ['parent_group', 'child_group']);
      for (const edge of edges) {
        const children = copied.get(edge.parent_group) ?? new Set<string>(); children.add(edge.child_group); copied.set(edge.parent_group, children);
      }
    }
    const edges: { parentGroup: string; childGroup: string; sortOrder: number }[] = [];
    for (const parentGroup of [...selections.keys()].toSorted()) {
      const groups = selections.get(parentGroup) ?? [], selected = maxChildren === null ? groups : groups.slice(0, maxChildren);
      for (const [sortOrder, childGroup] of selected.entries()) {
        if (!copied.get(parentGroup)?.has(childGroup)) edges.push({ parentGroup, childGroup, sortOrder });
      }
    }
    for (let offset = 0; offset < edges.length; offset += Math.floor(100 / 6)) {
      const values = edges.slice(offset, offset + Math.floor(100 / 6)).map(row =>
        sql`(${ulid()},${relationId},${row.parentGroup},${row.childGroup},${row.sortOrder},datetime('now'))`);
      statements.push(sql`INSERT INTO _cms_content_references (id,relation_id,parent_group,child_group,sort_order,created_at)
        VALUES ${sql.join(values)} ON CONFLICT DO NOTHING`.compile(database.db));
    }
    const validation = { ...field.parsedValidation, relation: slug, relationSide: 'parent',
      targetCollection: field.targetCollection, multiple: field.allowMultiple };
    statements.push(sql`UPDATE _cms_fields SET validation=${JSON.stringify(validation)} WHERE id=${field.field_id}`.compile(database.db));
    boundSlugs.add(slug);
  }
  return { guards, statements };
}
