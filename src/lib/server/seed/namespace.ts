// Registered Native seed composition on the existing canonical storage owner.
import { registerCanonicalTaxonomyDatabaseHandle } from '../canonical-storage/namespace.ts';
import { OperationNodeTransformer, NoResultError, isNoResultErrorConstructor, type CompiledQuery, type AliasNode, type Kysely, type KyselyPlugin,
  type TableNode, type RawNode, type RootOperationNode, type OperationNode,
  type IdentifierNode, type ReferenceNode, type ValueNode, type Compilable, type RawBuilder, type QueryResult } from 'kysely';
import type { CmsDatabase } from '../database/contract.ts';
import { registerRelationDatabase } from '../relations/storage.ts';
import { registerBlockDatabaseHost } from '../blocks/upstream/host.ts';
import { registerBylineDatabaseHandle } from '../bylines/storage.ts';
import { RawBindingD1Adapter } from '../database/d1.ts';
import { registerLifecycleDatabase } from '../database/lifecycle/upstream/host.ts';
import type { Database } from './upstream/database/types.ts';
import {applySeedContentCreate,applySeedContentUpdate,type SeedContentCreate,type SeedContentUpdate} from '../database/lifecycle/seed-plan.ts';
import {BylineRepository} from '../bylines/repository.ts';
import {TaxonomyRepository} from '../taxonomies/repository.ts';
import {RelationRepository} from '../relations/repository.ts';
import {SchemaRegistry as NativeSchemaRegistry} from '../database/registry.ts';
import {MediaRepository} from '../general-media/index.ts';
import {RedirectRepository} from '../redirects/repository.ts';
import {FTSManager} from '../content-picker/fts-manager.ts';
import {BlockTypeRegistry} from '../blocks/upstream/schema/block-type-registry.ts';
import {MediaUsageRepository} from './d1-media-usage.ts';
import {markContentMediaUsageCollectionStale,markContentMediaUsageCollectionStaleSafely} from '../blocks/upstream/media/usage/schema-invalidation.ts';
import {activateMediaUsageCapture} from '../blocks/upstream/media/usage/activation.ts';

// Contracts inspected at public Draft14 dd80fe3f; table installation is a separate prerequisite.
const names: Readonly<Record<string, string>> = {
  "revisions": "_cms_revisions",
  "_emdash_revision_prune_queue": "_cms_revision_prune_queue",
  "taxonomies": "_cms_taxonomies",
  "content_taxonomies": "_cms_content_taxonomies",
  "_emdash_taxonomy_defs": "_cms_taxonomy_defs",
  "_emdash_taxonomy_def_groups": "_cms_taxonomy_def_groups",
  "media": "_cms_media",
  "media_folders": "_cms_media_folders",
  "_emdash_media_upload_attempts": "_cms_media_upload_attempts",
  "_emdash_media_usage_sources": "_cms_media_usage_sources",
  "_emdash_media_usage": "_cms_media_usage",
  "_emdash_media_usage_cleanup": "_cms_media_usage_cleanup",
  "_emdash_media_usage_generation_writes": "_cms_media_usage_generation_writes",
  "_emdash_media_usage_cleanup_fence": "_cms_media_usage_cleanup_fence",
  "_emdash_media_usage_index_status": "_cms_media_usage_index_status",
  "_emdash_media_usage_activation": "_cms_media_usage_activation",
  "_emdash_media_usage_work": "_cms_media_usage_work",
  "_emdash_media_usage_collection_deletions": "_cms_media_usage_collection_deletions",
  "_emdash_media_usage_reconciliations": "_cms_media_usage_reconciliations",
  "options": "_cms_options",
  "_emdash_collections": "_cms_collections",
  "_emdash_fields": "_cms_fields",
  "_plugin_storage": "_cms_plugin_storage",
  "_plugin_state": "_cms_plugin_state",
  "_plugin_indexes": "_cms_plugin_indexes",
  "_emdash_menus": "_cms_menus",
  "_emdash_menu_items": "_cms_menu_items",
  "_emdash_widget_areas": "_cms_widget_areas",
  "_emdash_widgets": "_cms_widgets",
  "_emdash_sections": "_cms_sections",
  "_emdash_comments": "_cms_comments",
  "_emdash_comment_reactions": "_cms_comment_reactions",
  "_emdash_redirects": "_cms_redirects",
  "_emdash_redirect_write_lock": "_cms_redirect_write_lock",
  "_emdash_redirect_state": "_cms_redirect_state",
  "_emdash_redirect_artifacts": "_cms_redirect_artifacts",
  "_emdash_redirect_generation_artifacts": "_cms_redirect_generation_artifacts",
  "_emdash_404_log": "_cms_404_log",
  "_emdash_bylines": "_cms_bylines",
  "_emdash_content_bylines": "_cms_content_bylines",
  "_emdash_byline_fields": "_cms_byline_fields",
  "_emdash_byline_field_values": "_cms_byline_field_values",
  "_emdash_byline_field_group_values": "_cms_byline_field_group_values",
  "_emdash_relations": "_cms_relations",
  "_emdash_content_references": "_cms_content_references",
  "_emdash_block_types": "_cms_block_types",
  "_emdash_block_type_versions": "_cms_block_type_versions",
  "_emdash_seo": "_cms_seo"
};
const unavailable = new Set([
  "users", // Native authentication rows do not supply Source split-profile/role semantics.
  "credentials",
  "auth_tokens",
  "oauth_accounts",
  "allowed_domains",
  "auth_challenges",
  "audit_logs",
  "_emdash_migrations",
  "_emdash_api_tokens",
  "_emdash_oauth_tokens",
  "_emdash_device_codes",
  "_emdash_authorization_codes",
  "_emdash_oauth_clients",
  "_emdash_cron_tasks",
  "_emdash_rate_limits",
  "_emdash_entry_locks",
  "_emdash_transfer_operations",
  "_emdash_transfer_identity_map",
  "_emdash_transfer_staged_files",
  "_emdash_transfer_package_index",
  "_emdash_transfer_media_blobs",
  "_emdash_transfer_approvals"
]);
function mappedName(name: string): string {
  if (unavailable.has(name)) throw new Error(`Source table ${name} has no qualified seed provider`);
  return Object.hasOwn(names, name) ? names[name] : name;
}
interface Token { text: string; name?: string; literal?: string; start: number; end: number; parameter?: number }
function tokens(text: string): Token[] {
  const result: Token[] = [];
  const pattern = /\x00P\d+\x00|--[^\r\n]*|\/\*[\s\S]*?\*\/|'(?:''|[^'])*'|"(?:""|[^"])*"|`(?:``|[^`])*`|\[[^\]]*\]|[A-Za-z_][A-Za-z_0-9]*|\?|[^\s]/g;
  for (const match of text.matchAll(pattern)) {
    const value = match[0];
    if (value.startsWith('--') || value.startsWith('/*')) continue;
    if (value.startsWith("'")) {
      result.push({ text: value, literal: value.slice(1, -1).replaceAll("''", "'"), start: match.index, end: match.index + value.length });
      continue;
    }
    const quoted = value.startsWith('"') || value.startsWith('`') || value.startsWith('[');
    const name = quoted ? value.slice(1, -1).replaceAll(value[0] + value[0], value[0]) : /^[A-Za-z_]/.test(value) ? value : undefined;
    result.push({ text: value, name, start: match.index, end: match.index + value.length,
      ...(value.startsWith('\x00P') ? { parameter: Number(value.slice(2, -1)) } : {}) });
  }
  return result;
}
function replaceToken(token: Token, name: string): string {
  if (token.text.startsWith('"')) return '"' + name.replaceAll('"', '""') + '"';
  if (token.text.startsWith('`')) return '`' + name.replaceAll('`', '``') + '`';
  if (token.text.startsWith('[')) return '[' + name + ']';
  return name;
}
const reserved = new Set(['WHERE','JOIN','INNER','LEFT','RIGHT','OUTER','CROSS','ON','GROUP','ORDER','LIMIT','OFFSET','UNION','RETURNING','SET','VALUES','SELECT','INSERT','UPDATE','DELETE','HAVING','WINDOW','AS','WHEN','BEGIN','END']);
interface RawAnalysis { fragments: string[]; catalogParameters: Set<number>; patternParameters: Set<number>; catalog: boolean; tableCatalog: boolean; foreignKeyCatalog: boolean; tableParameters: Set<number>; aliases: Set<string> }
interface PredicateTruth { tableTrue: boolean; tableFalse: boolean; otherTrue: boolean; otherFalse: boolean }
const unknownPredicate: PredicateTruth = { tableTrue: true, tableFalse: true, otherTrue: true, otherFalse: true };
function keyword(token: Token | undefined, word: string): boolean {
  return token?.text === token?.name && token?.name?.toUpperCase() === word;
}
/** Conservative inference for supported Boolean WHERE constraints, not a SQL parser. */
function tableOnlyPredicate(list: readonly Token[], node: RawNode): boolean {
  let depth = 0;
  let start = -1;
  let end = list.length;
  for (let index = 0; index < list.length; index++) {
    const token = list[index];
    if (token.text === '(') depth++;
    else if (token.text === ')') depth--;
    else if (depth === 0 && keyword(token, 'WHERE') && start < 0) start = index + 1;
    else if (depth === 0 && start >= 0 && ['GROUP','ORDER','LIMIT','OFFSET','UNION','WINDOW','RETURNING'].some(word => keyword(token, word))) { end = index; break; }
  }
  if (start < 0) return false;
  function truth(input: readonly Token[]): PredicateTruth {
    if (input.length === 0 || input.some(token => keyword(token, 'BETWEEN') || keyword(token, 'CASE'))) return unknownPredicate;
    let values = input;
    while (values[0]?.text === '(' && values.at(-1)?.text === ')') {
      let nesting = 0;
      let closesEarly = false;
      for (let index = 0; index < values.length - 1; index++) {
        if (values[index].text === '(') nesting++;
        else if (values[index].text === ')') nesting--;
        if (nesting === 0) { closesEarly = true; break; }
      }
      if (closesEarly) break;
      values = values.slice(1, -1);
    }
    for (const operator of ['OR','AND']) {
      let nesting = 0;
      for (let index = 0; index < values.length; index++) {
        if (values[index].text === '(') nesting++;
        else if (values[index].text === ')') nesting--;
        else if (nesting === 0 && keyword(values[index], operator)) {
          const left = truth(values.slice(0, index));
          const right = truth(values.slice(index + 1));
          return operator === 'AND'
            ? { tableTrue: left.tableTrue && right.tableTrue, tableFalse: left.tableFalse || right.tableFalse,
                otherTrue: left.otherTrue && right.otherTrue, otherFalse: left.otherFalse || right.otherFalse }
            : { tableTrue: left.tableTrue || right.tableTrue, tableFalse: left.tableFalse && right.tableFalse,
                otherTrue: left.otherTrue || right.otherTrue, otherFalse: left.otherFalse && right.otherFalse };
        }
      }
    }
    if (keyword(values[0], 'NOT')) {
      const inner = truth(values.slice(1));
      return { tableTrue: inner.tableFalse, tableFalse: inner.tableTrue,
        otherTrue: inner.otherFalse, otherFalse: inner.otherTrue };
    }
    const column = values[1]?.text === '.' ? 2 : 0;
    if (values.length !== column + 3 || values[column]?.name?.toLowerCase() !== 'type' || values[column + 1]?.text !== '=') return unknownPredicate;
    const right = values[column + 2];
    const parameter = right.parameter === undefined ? undefined : node.parameters[right.parameter];
    const value = right.literal ?? (parameter?.kind === 'ValueNode' ? (parameter as ValueNode).value : undefined);
    return value === 'table' ? { tableTrue: true, tableFalse: false, otherTrue: false, otherFalse: true } : unknownPredicate;
  }
  const result = truth(list.slice(start, end));
  return result.tableTrue && !result.otherTrue;
}
function analyzeRaw(node: RawNode, mapping = names, refuseUnavailable = true): RawAnalysis {
  const text = node.sqlFragments.map((fragment, index) => fragment + (index < node.parameters.length ? `\x00P${index}\x00` : '')).join('');
  const list = tokens(text);
  const aliases = new Set<string>();
  const targets = new Set<number>();
  for (let index = 0; index < list.length; index++) {
    const word = list[index].name?.toUpperCase();
    let next = index + 1;
    const tableKeyword = word === 'FROM' || word === 'JOIN' || word === 'UPDATE' || word === 'INTO' || word === 'REFERENCES' || word === 'TABLE' && ['CREATE','ALTER','DROP'].includes(list[index - 1]?.name?.toUpperCase() ?? '') || word === 'ON' && list.some(token => ['INDEX','TRIGGER'].includes(token.name?.toUpperCase() ?? '')) && list.some(token => token.name?.toUpperCase() === 'CREATE');
    if (!tableKeyword) continue;
    if (list[next]?.name?.toUpperCase() === 'IF') next += list[next + 1]?.name?.toUpperCase() === 'NOT' ? 3 : 2;
    if (!list[next] || list[next].text === '(') continue;
    // Qualified names in other schemas belong to their owner, not this namespace.
    if (list[next + 1]?.text !== '.') targets.add(next);
    else next += 2;
    let alias = next + 1;
    if (list[alias]?.name?.toUpperCase() === 'AS') alias++;
    const candidate = list[alias];
    if (candidate?.name && !reserved.has(candidate.name.toUpperCase())) aliases.add(candidate.name);
  }
  const tableParameters = new Set<number>();
  for (const index of targets) if (list[index].parameter !== undefined) tableParameters.add(list[index].parameter!);
  const changes: { start: number; end: number; replacement: string }[] = [];
  for (let index = 0; index < list.length; index++) {
    const token = list[index];
    if (!token.name) continue;
    const reference = list[index + 1]?.text === '.' && list[index - 1]?.text !== '.' && !aliases.has(token.name);
    if (!targets.has(index) && !reference) continue;
    const name = refuseUnavailable && unavailable.has(token.name) ? mappedName(token.name) : Object.hasOwn(mapping, token.name) ? mapping[token.name] : token.name;
    if (name !== token.name) changes.push({ start: token.start, end: token.end, replacement: replaceToken(token, name) });
  }
  const catalogParameters = new Set<number>();
  const patternParameters = new Set<number>();
  const catalog = list.some(token => ['sqlite_master','sqlite_schema'].includes(token.name?.toLowerCase() ?? ''));
  // One SELECT's predicate cannot govern compound result object names. Fail closed
  // during transformation, before compilation or any real connection execution.
  if (catalog && list.some(token => ['UNION','INTERSECT','EXCEPT'].some(word => keyword(token, word)))) {
    throw new Error('Seed compound catalog queries are not qualified');
  }
  // Only a supported positive constraint may identify unselected table object names.
  const tableCatalog = tableOnlyPredicate(list, node);
  const foreignKeyCatalog = list.some(token => token.name?.toLowerCase() === 'foreign_key_list');
  for (let index = 0; index < list.length; index++) {
    if (['pragma_table_info','table_info','table_xinfo','foreign_key_list','index_list'].includes(list[index].name?.toLowerCase() ?? '') && list[index + 1]?.text === '(' && list[index + 2]?.parameter !== undefined) {
      catalogParameters.add(list[index + 2].parameter!);
    }
    if (catalog && (list[index].name?.toLowerCase() === 'tbl_name' || tableCatalog && list[index].name?.toLowerCase() === 'name') && list[index + 1]?.text === '=' && list[index + 2]?.parameter !== undefined) {
      catalogParameters.add(list[index + 2].parameter!);
    }
    if (catalog && list[index].name?.toLowerCase() === 'name' && list[index + 1]?.name?.toUpperCase() === 'LIKE' && list[index + 2]?.parameter !== undefined) {
      patternParameters.add(list[index + 2].parameter!);
    }
  }
  let rewritten = text;
  for (const change of changes.reverse()) rewritten = rewritten.slice(0, change.start) + change.replacement + rewritten.slice(change.end);
  return { fragments: rewritten.split(/\x00P\d+\x00/), catalogParameters, patternParameters, catalog, tableCatalog, foreignKeyCatalog, tableParameters, aliases };
}
function aliasesIn(node: OperationNode, aliases = new Set<string>(), root = true): Set<string> {
  if (!root && ['SelectQueryNode','InsertQueryNode','UpdateQueryNode','DeleteQueryNode'].includes(node.kind)) return aliases;
  if (node.kind === 'AliasNode') {
    const value = node as AliasNode;
    if (value.alias.kind === 'IdentifierNode') aliases.add((value.alias as IdentifierNode).name);
  }
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      for (const child of value) if (child && typeof child === 'object' && 'kind' in child) aliasesIn(child as OperationNode, aliases, false);
    } else if (value && typeof value === 'object' && 'kind' in value) aliasesIn(value as OperationNode, aliases, false);
  }
  return aliases;
}
class SeedNamespace extends OperationNodeTransformer {
  protected override transformTable(node: TableNode): TableNode {
    const transformed = super.transformTable(node);
    if (node.table.schema && node.table.schema.name !== 'main') return transformed;
    const parent = this.nodeStack.at(-2);
    if (parent?.kind === 'ReferenceNode' || parent?.kind === 'SelectAllNode') {
      const query = this.nodeStack.findLast(item => ['SelectQueryNode','InsertQueryNode','UpdateQueryNode','DeleteQueryNode'].includes(item.kind));
      if (query && aliasesIn(query).has(node.table.identifier.name)) return transformed;
      const raw = this.nodeStack.find(item => item.kind === 'RawNode') as RawNode | undefined;
      if (!query && raw && analyzeRaw(raw).aliases.has(node.table.identifier.name)) return transformed;
    }
    const name = mappedName(node.table.identifier.name);
    return name === node.table.identifier.name ? transformed : { ...transformed, table: { ...transformed.table,
      identifier: { ...transformed.table.identifier, name } } };
  }
  protected override transformRaw(node: RawNode): RawNode {
    const analysis = analyzeRaw(node);
    const transformed = super.transformRaw(node);
    return { ...transformed, sqlFragments: analysis.fragments, parameters: transformed.parameters.map((parameter, index) => {
      if (analysis.patternParameters.has(index) && parameter.kind === 'ValueNode') {
        const value = (parameter as ValueNode).value;
        return typeof value === 'string' && value.startsWith('_emdash_') ? { ...parameter, value: '_cms_' + value.slice('_emdash_'.length) } : parameter;
      }
      return analysis.catalogParameters.has(index) || analysis.tableParameters.has(index) && parameter.kind !== 'ValueNode' ? mapCatalogParameter(parameter) : parameter;
    }) };
  }
}
function mapCatalogParameter(parameter: OperationNode): OperationNode {
  if (parameter.kind === 'ValueNode') {
    const value = (parameter as ValueNode).value;
    return typeof value === 'string' ? { ...(parameter as ValueNode), value: mappedName(value) } as ValueNode : parameter;
  }
  if (parameter.kind === 'ReferenceNode') {
    const reference = parameter as ReferenceNode;
    if (!reference.table && reference.column.kind === 'ColumnNode') {
      const name = reference.column.column.name;
      return { ...reference, column: { ...reference.column, column: { ...reference.column.column, name: mappedName(name) } } } as ReferenceNode;
    }
  }
  if (parameter.kind === 'RawNode') {
    const raw = parameter as RawNode;
    if (raw.parameters.length === 1 && raw.sqlFragments.every(fragment => fragment === '')) return { ...raw, parameters: [mapCatalogParameter(raw.parameters[0])] } as RawNode;
  }
  return parameter;
}
function sourceIdentifierParameter(parameter: OperationNode): boolean {
  if (parameter.kind === 'ValueNode') {
    const value = (parameter as ValueNode).value;
    return typeof value === 'string' && (Object.hasOwn(names, value) || value.startsWith('_emdash_'));
  }
  if (parameter.kind === 'ReferenceNode') {
    const reference = parameter as ReferenceNode;
    return !reference.table && reference.column.kind === 'ColumnNode' && Object.hasOwn(names, reference.column.column.name);
  }
  if (parameter.kind === 'RawNode') return (parameter as RawNode).parameters.some(sourceIdentifierParameter);
  return false;
}
function catalogMappingRequested(node: OperationNode): boolean {
  if (node.kind === 'RawNode') {
    const raw = node as RawNode;
    const analysis = analyzeRaw(raw);
    return [...analysis.catalogParameters, ...analysis.patternParameters].some(index => raw.parameters[index] && sourceIdentifierParameter(raw.parameters[index]));
  }
  return false;
}
const reverseNames: Record<string, string> = Object.fromEntries(Object.entries(names).map(([source, native]) => [native, source]));
interface CatalogResultContext { pattern?: string; sqliteObjects: boolean; tablesOnly: boolean; foreignKeys: boolean }
const catalogResults = new WeakMap<object, CatalogResultContext>();
function sourceCatalogPattern(node: RootOperationNode): string | undefined {
  if (node.kind !== 'RawNode') return undefined;
  const analysis = analyzeRaw(node);
  for (const index of analysis.patternParameters) {
    const parameter = node.parameters[index];
    if (parameter?.kind === 'ValueNode' && typeof (parameter as ValueNode).value === 'string') return (parameter as ValueNode).value as string;
  }
  return undefined;
}
function sqlLike(pattern: string, value: string): boolean {
  const expression = [...pattern].map(character => character === '%' ? '.*' : character === '_' ? '.' : character.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('');
  return new RegExp('^' + expression + '$', 'i').test(value);
}
const transformer = new SeedNamespace();
const namespace: KyselyPlugin = {
  transformQuery(args) {
    if (catalogMappingRequested(args.node)) {
      const analysis = analyzeRaw(args.node as RawNode);
      catalogResults.set(args.queryId, { pattern: sourceCatalogPattern(args.node),
        sqliteObjects: analysis.catalog, tablesOnly: analysis.tableCatalog, foreignKeys: analysis.foreignKeyCatalog });
    }
    return transformer.transformNode(args.node);
  },
  async transformResult({ queryId, result }) {
    if (!catalogResults.has(queryId)) return result;
    const context = catalogResults.get(queryId)!;
    return { ...result, rows: result.rows.map(row => {
      const output = { ...row };
      // sqlite_master.name denotes an object, not always a table. PRAGMA names
      // denote columns/indexes and must stay opaque; only FK.table is a table.
      const tableObject = output.type === 'table' || output.type === undefined && context.tablesOnly;
      const keys = context.sqliteObjects ? ['tbl_name', ...(tableObject ? ['name'] : [])] : context.foreignKeys ? ['table'] : [];
      for (const key of keys) if (typeof output[key] === 'string' && Object.hasOwn(reverseNames, output[key])) output[key] = reverseNames[output[key]];
      if (context.sqliteObjects && typeof output.sql === 'string') output.sql = analyzeRaw({ kind: 'RawNode', sqlFragments: [output.sql], parameters: [] }, reverseNames, false).fragments[0];
      return output;
    }).filter(row => context.pattern === undefined || typeof row.name === 'string' && sqlLike(context.pattern, row.name)) };
  }
};

// Preserve the published options-only raw-D1 write boundary. This prototype does not
// authorize a non-atomic seed write, callback fallback, raw DDL or capture mutation.
const unavailableD1Write = 'D1 taxonomy writes require atomic adaptation';
function tableName(node: OperationNode | undefined): string | undefined {
  return node?.kind === 'TableNode' ? (node as TableNode).table.identifier.name : undefined;
}
function optionMutation(node: RootOperationNode): boolean {
  let target: string | undefined;
  if (node.kind === 'InsertQueryNode' && !node.with) target = tableName(node.into);
  if (node.kind === 'UpdateQueryNode' && !node.with && !node.from && !node.joins) target = tableName(node.table);
  if (node.kind === 'DeleteQueryNode' && !node.with && !node.using && node.from.froms.length === 1) target = tableName(node.from.froms[0]);
  return target === 'options' || target === '_cms_options';
}
function rawCode(node: RawNode): string {
  return node.sqlFragments.join('?').replace(/--[^\r\n]*|\/\*[\s\S]*?\*\/|'(?:''|[^'])*'|"(?:""|[^"])*"|`(?:``|[^`])*`|\[[^\]]*\]/g,' ');
}
function readonlyCatalogPragma(node: RawNode): boolean {
  return /^\s*PRAGMA\s+(?:table_info|table_xinfo|index_info|index_xinfo|foreign_key_list|index_list)\s*\([^;]*\)\s*$/i.test(rawCode(node));
}
const mutationSql = /;|\b(?:INSERT|UPDATE|DELETE|REPLACE|CREATE|DROP|ALTER|REINDEX|VACUUM|ATTACH|DETACH|PRAGMA)\b/i;
class D1SourceQueryBoundary extends OperationNodeTransformer {
  protected override transformRaw(node: RawNode): RawNode {
    if (!readonlyCatalogPragma(node) && mutationSql.test(rawCode(node))) throw new Error(unavailableD1Write);
    return super.transformRaw(node);
  }
  protected override transformNodeImpl<T extends OperationNode>(node: T): T {
    if (node.kind === 'InsertQueryNode' || node.kind === 'UpdateQueryNode' || node.kind === 'DeleteQueryNode') {
      if (!optionMutation(node as RootOperationNode)) throw new Error(unavailableD1Write);
    }
    if (node.kind === 'SelectQueryNode' && (node as Extract<RootOperationNode, {kind:'SelectQueryNode'}>).with) {
      throw new Error(unavailableD1Write);
    }
    return super.transformNodeImpl(node);
  }
}
const d1Boundary = new D1SourceQueryBoundary();
const d1SourceBoundary: KyselyPlugin = {
  transformQuery({node}) {
    const read = node.kind === 'SelectQueryNode' && !node.with || node.kind === 'RawNode' &&
      (/^[ \t\r\n\f]*SELECT\b/i.test(rawCode(node)) || readonlyCatalogPragma(node));
    if (!read && !optionMutation(node)) throw new Error(unavailableD1Write);
    return d1Boundary.transformNode(node);
  },
  transformResult: async ({result}) => result
};

function logicalPlugin(plugin: KyselyPlugin): KyselyPlugin {
  return {
    transformQuery: args => plugin.transformQuery(args),
    async transformResult(args) {
      const result = await namespace.transformResult(args);
      return plugin.transformResult({ ...args, result });
    }
  };
}
interface SeedViewContext {
  owner: CmsDatabase;
  logical: Kysely<any>;
  atomicLogical: Kysely<any>;
}
const views = new WeakMap<object, SeedViewContext>();
/** Proposal only: preserves Source observers and real ownership across derived views. */
export function seedSourceDatabase(database: CmsDatabase): Kysely<Database> {
  const base = database.db.getExecutor().adapter instanceof RawBindingD1Adapter
    ? database.db.withPlugin(d1SourceBoundary) : database.db;
  function view(logical: Kysely<any>, atomicLogical: Kysely<any>, owner: CmsDatabase = database): Kysely<Database> {
    const target = logical.withPlugin(namespace);
    const proxy = new Proxy(target, { get(instance, key) {
      if (key === 'withPlugin') return (plugin: KyselyPlugin) => {
        const wrapped = logicalPlugin(plugin);
        return view(logical.withPlugin(wrapped), atomicLogical.withPlugin(wrapped), owner);
      };
      if (key === 'withSchema') return (schema: string) => view(logical.withSchema(schema), atomicLogical.withSchema(schema), owner);
      if (key === 'withTables') return () => view(logical.withTables(), atomicLogical.withTables(), owner);
      if (key === 'transaction') return () => {
        // Kysely owns this genuine transaction and its single commit/rollback.
        // Derived handles retain observers and use the same transaction for plans.
        const wrapBuilder = (builder: ReturnType<Kysely<any>['transaction']>): typeof builder =>
          new Proxy(builder, { get(current, member) {
            if (member === 'execute') return (run: (db: Kysely<Database>) => Promise<unknown>) =>
              current.execute(async trx => {
                const transactionOwner: CmsDatabase = {
                  ...owner,
                  db: trx as unknown as CmsDatabase['db'],
                  async atomicBatch(statements) {
                    const results: QueryResult<unknown>[] = [];
                    for (const statement of statements) results.push(await trx.executeQuery(statement));
                    return results;
                  },
                  async close() { throw new Error('A transaction does not own the database connection'); }
                };
                return run(view(trx, trx, transactionOwner));
              });
            const value = Reflect.get(current, member, current);
            return typeof value === 'function' ? (...args: unknown[]) =>
              wrapBuilder(value.apply(current, args)) : value;
          } });
        return wrapBuilder(logical.transaction());
      };
      if (key === 'withoutPlugins') return () => { throw new Error('Removing seed namespace/boundary plugins is not qualified'); };
      const value = Reflect.get(instance, key, instance);
      return typeof value === 'function' ? value.bind(instance) : value;
    } }) as Kysely<Database>;
    views.set(proxy, { owner, logical, atomicLogical });
    registerLifecycleDatabase({ ...owner, db: proxy as unknown as CmsDatabase['db'] });
    registerRelationDatabase(owner, proxy);
    registerCanonicalTaxonomyDatabaseHandle(owner,proxy as unknown as Parameters<typeof registerCanonicalTaxonomyDatabaseHandle>[1]);
    registerBlockDatabaseHost({ ...owner, db: proxy as unknown as CmsDatabase['db'] });
    registerBylineDatabaseHandle(owner, proxy as unknown as Parameters<typeof registerBylineDatabaseHandle>[1]);
    return proxy;
  }
  return view(base, database.db);
}
/** Trusted handle identity lookup; unknown handles never gain an owner. */
export function registeredSeedDatabaseOwner(db: object): CmsDatabase | undefined {
  return views.get(db)?.owner;
}
/** Resolve the real trusted owner for native schema and fixed domain plans. */
export function seedDatabaseOwner(db: object): CmsDatabase {
  const context = views.get(db);
  if (!context) throw new Error('Seed operations require their actual registered CMS database owner');
  return context.owner;
}
function assertNativeRead(query:RootOperationNode):void {
  const refuse=()=>{throw new Error('Seed Native producer descriptor executes only real reads; writes require the existing fixed atomic owner');};
  if(query.kind!=='SelectQueryNode'&&!(query.kind==='RawNode'&&(/^[\s]*?(?:SELECT|WITH)\b/i.test(rawCode(query))||readonlyCatalogPragma(query))))refuse();
  function visit(node:OperationNode):void {
    if(/^(?:Insert|Update|Delete|Create|Alter|Drop|Merge|Replace|Truncate|Refresh|Grant|Revoke)/.test(node.kind))refuse();
    if(node.kind==='RawNode'&&mutationSql.test(rawCode(node as RawNode))&&!readonlyCatalogPragma(node as RawNode))refuse();
    // Parameter payloads are data, not executable operation-node children.
    if(node.kind==='ValueNode'||node.kind==='PrimitiveValueListNode')return;
    for(const value of Object.values(node)){
      if(Array.isArray(value)){for(const child of value)if(child&&typeof child==='object'&&'kind'in child)visit(child as OperationNode);}
      else if(value&&typeof value==='object'&&'kind'in value)visit(value as OperationNode);
    }
  }
  visit(query);
}
/** Internal hosting only: actual reads and compilation retain caller plugins.
 * No executable mutation descriptor is returned through a public Source API. */
function nativeReadCompiler<T extends object>(target:T,executionTarget:any=target):T {
  function builder<B extends object>(value:B,additionalPlugins:readonly KyselyPlugin[]=[]):B {
    return new Proxy(value,{get(instance,key){
      if(key==='execute'||key==='executeTakeFirst'||key==='executeTakeFirstOrThrow')return async(optionsOrConstructor?:any)=>{
        const compiled=(instance as any).compile();assertNativeRead(compiled.query);
        const options=key==='executeTakeFirstOrThrow'&&typeof optionsOrConstructor==='function'?{errorConstructor:optionsOrConstructor}:optionsOrConstructor;
        let result=await executionTarget.getExecutor().executeQuery(compiled,options);
        for(const plugin of additionalPlugins)result=await plugin.transformResult({result,queryId:compiled.queryId});
        if(key==='execute')return result.rows;
        const row=result.rows[0];
        if(row===undefined&&key==='executeTakeFirstOrThrow'){
          const errorConstructor=options?.errorConstructor??NoResultError;
          throw isNoResultErrorConstructor(errorConstructor)?new errorConstructor(compiled.query):errorConstructor(compiled.query);
        }
        return row;
      };
      if(key==='stream'||key==='explain')return()=>{throw new Error('Seed Native producer descriptor does not expose streaming or arbitrary explanation execution');};
      const member=Reflect.get(instance,key,instance);
      if(typeof member==='function')return(...args:unknown[])=>{const result=member.apply(instance,args);return result&&typeof result==='object'&&('compile'in result||'toOperationNode'in result)?builder(result,key==='withPlugin'?[...additionalPlugins,args[0] as KyselyPlugin]:additionalPlugins):result;};
      return member;
    }});
  }
  return new Proxy(target,{get(instance,key){
    if(key==='getExecutor')return()=>{const executor=(instance as any).getExecutor();return new Proxy(executor,{get(current,member){
      if(member==='executeQuery')return(compiled:CompiledQuery,...args:unknown[])=>{assertNativeRead(compiled.query);return current.executeQuery(compiled,...args);};
      if(member==='provideConnection'||member==='stream'||member==='withConnectionProvider')return()=>{throw new Error('Seed Native producer descriptor exposes no connection execution escape');};
      const value=Reflect.get(current,member,current);return typeof value==='function'?value.bind(current):value;
    }});};
    if(key==='executeQuery')return(compiled:CompiledQuery,...args:unknown[])=>{assertNativeRead(compiled.query);return (instance as any).executeQuery(compiled,...args);};
    if(key==='transaction'||key==='connection'||key==='destroy'||key==='withoutPlugins')return()=>{throw new Error('Seed Native producer descriptor retains its real owner and exposes no callback/connection/lifecycle escape');};
    const value=Reflect.get(instance,key,instance);
    if(typeof value==='function')return(...args:unknown[])=>{
      const result=value.apply(instance,args);
      if(result&&typeof result==='object'&&'getExecutor'in result)return nativeReadCompiler(result);
      if(result&&typeof result==='object'&&'selectFrom'in result&&'insertInto'in result)return nativeReadCompiler(result,executionTarget);
      return result&&typeof result==='object'&&('compile'in result||'toOperationNode'in result)?builder(result):result;
    };
    return value&&typeof value==='object'&&key==='schema'?builder(value):value;
  }});
}
function nativeHostedOwner(db:Kysely<any>,readonly:boolean):CmsDatabase {
  const context=views.get(db);if(!context)throw new Error('Seed Native domain requires its actual registered query handle');
  const target=context.atomicLogical.withPlugin(namespace),hosted=readonly?nativeReadCompiler(target):target;
  const plugins=target.getExecutor().plugins;
  return{...context.owner,db:hosted as unknown as CmsDatabase['db'],async atomicBatch(statements){
    const results=await context.owner.atomicBatch(statements),transformed:QueryResult<unknown>[]=[];
    for(let index=0;index<results.length;index++){
      let result=results[index];for(const plugin of plugins)result=await plugin.transformResult({result:result as QueryResult<import('kysely').UnknownRow>,queryId:statements[index].queryId});
      transformed.push(result);
    }
    return transformed;
  },async close(){throw new Error('Seed Native content does not own the database lifecycle');}};
}
/** Finite existing canonical domains; neither exposes an executable write handle. */
export function seedNativeContentCreate(db:Kysely<any>,input:SeedContentCreate){return applySeedContentCreate(nativeHostedOwner(db,true),input);}
export function seedNativeContentUpdate(db:Kysely<any>,input:SeedContentUpdate){return applySeedContentUpdate(nativeHostedOwner(db,true),input);}
export function seedNativeBylines(db:Kysely<any>){return new BylineRepository(nativeHostedOwner(db,true));}
export function seedNativeTaxonomies(db:Kysely<any>){const owner=nativeHostedOwner(db,true);registerCanonicalTaxonomyDatabaseHandle(owner,owner.db as unknown as ConstructorParameters<typeof TaxonomyRepository>[0]);return new TaxonomyRepository(owner.db as unknown as ConstructorParameters<typeof TaxonomyRepository>[0]);}
/** These existing imperative repositories execute their own qualified methods.
 * Their private query view retains real caller observers on the same adapter;
 * no general executable query handle is returned by this composition API. */
export function seedNativeMedia(db:Kysely<any>){return new MediaRepository(nativeHostedOwner(db,false));}
export function seedNativeRelations(db:Kysely<any>){return new RelationRepository(nativeHostedOwner(db,false));}
export function seedNativeRedirects(db:Kysely<any>){return new RedirectRepository(nativeHostedOwner(db,false).db as unknown as ConstructorParameters<typeof RedirectRepository>[0]);}
export function seedNativeFts(db:Kysely<any>){return new FTSManager(nativeHostedOwner(db,false).db as unknown as ConstructorParameters<typeof FTSManager>[0]);}
export function seedNativeBlocks(db:Kysely<any>){const owner=nativeHostedOwner(db,false);registerBlockDatabaseHost(owner);return new BlockTypeRegistry(owner.db as unknown as ConstructorParameters<typeof BlockTypeRegistry>[0]);}
export function seedNativeSchemaRegistry(db:Kysely<any>){return new NativeSchemaRegistry(nativeHostedOwner(db,false));}
/** Fresh-site default initialization calls the existing capture producer before
 * creating schema. Its actual registered owner and caller observers remain. */
export function seedNativeActivateMediaUsageCapture(db:Kysely<any>){const owner=nativeHostedOwner(db,false);registerBlockDatabaseHost(owner);return activateMediaUsageCapture(owner.db as unknown as Parameters<typeof activateMediaUsageCapture>[0],{writersDrained:true});}
export function seedNativeMediaUsage(db:Kysely<any>){const owner=nativeHostedOwner(db,false);registerBlockDatabaseHost(owner);return new MediaUsageRepository(owner.db as unknown as ConstructorParameters<typeof MediaUsageRepository>[0]);}
export function seedNativeMarkMediaStale(db:Kysely<any>,...args:Parameters<typeof markContentMediaUsageCollectionStale> extends [unknown,...infer A]?A:never){const owner=nativeHostedOwner(db,false);registerBlockDatabaseHost(owner);return markContentMediaUsageCollectionStale(owner.db as unknown as Parameters<typeof markContentMediaUsageCollectionStale>[0],...args);}
export function seedNativeMarkMediaStaleSafely(db:Kysely<any>,...args:Parameters<typeof markContentMediaUsageCollectionStaleSafely> extends [unknown,...infer A]?A:never){const owner=nativeHostedOwner(db,false);registerBlockDatabaseHost(owner);return markContentMediaUsageCollectionStaleSafely(owner.db as unknown as Parameters<typeof markContentMediaUsageCollectionStaleSafely>[0],...args);}
function nativeRefreshReadView(db:Kysely<any>):Kysely<Database>{
  const context=views.get(db);if(!context)throw new Error('Seed Native refresh requires its actual registered query handle');
  const read=nativeReadCompiler(context.atomicLogical.withPlugin(namespace));
  // Only these finite real refresh functions receive this private view. Their
  // qualified usage/invalidation factories retain the same underlying context.
  views.set(read,context);
  return read as Kysely<Database>;
}
type RefreshModule=typeof import('./upstream/media/usage/content-refresh-d1.ts');
type DomainArguments<F extends (...args:any[])=>any>=Parameters<F> extends [unknown,...infer A]?A:never;
export async function seedNativeRefreshContentMediaUsage(db:Kysely<Database>,...args:DomainArguments<RefreshModule['refreshContentMediaUsage']>){const read=nativeRefreshReadView(db),actual=await import('./upstream/media/usage/content-refresh-d1.ts');return actual.refreshContentMediaUsage(read,...args);}
export async function seedNativeRefreshContentMediaUsageForWorkBatch(db:Kysely<Database>,...args:DomainArguments<RefreshModule['refreshContentMediaUsageForWorkBatch']>){const read=nativeRefreshReadView(db),actual=await import('./upstream/media/usage/content-refresh-d1.ts');return actual.refreshContentMediaUsageForWorkBatch(read,...args);}
export async function seedNativeDeleteContentMediaUsage(db:Kysely<Database>,...args:DomainArguments<RefreshModule['deleteContentMediaUsage']>){const read=nativeRefreshReadView(db),actual=await import('./upstream/media/usage/content-refresh-d1.ts');return actual.deleteContentMediaUsage(read,...args);}
export async function seedNativeDeleteContentMediaUsageCollection(db:Kysely<Database>,...args:DomainArguments<RefreshModule['deleteContentMediaUsageCollection']>){const read=nativeRefreshReadView(db),actual=await import('./upstream/media/usage/content-refresh-d1.ts');return actual.deleteContentMediaUsageCollection(read,...args);}
export async function seedNativeRefreshContentMediaUsageAfterWrite(db:Kysely<Database>,...args:DomainArguments<RefreshModule['refreshContentMediaUsageAfterWrite']>){const read=nativeRefreshReadView(db),actual=await import('./upstream/media/usage/content-refresh-d1.ts');return actual.refreshContentMediaUsageAfterWrite(read,...args);}
export async function seedNativeFindNonTranslatableSiblingContentIds(db:Kysely<Database>,...args:DomainArguments<RefreshModule['findNonTranslatableSiblingContentIds']>){const read=nativeRefreshReadView(db),actual=await import('./upstream/media/usage/content-refresh-d1.ts');return actual.findNonTranslatableSiblingContentIds(read,...args);}
const executeMethods = new Set(['execute','executeQuery','executeTakeFirst','executeTakeFirstOrThrow','stream','explain']);
/** Builders used to prepare a batch cannot execute queries or callbacks themselves. */
function compilationOnly<T extends object>(target: T): T {
  return new Proxy(target, { get(instance, key) {
    if (typeof key === 'string' && executeMethods.has(key)) return () => { throw new Error('Seed plans execute only through the real atomic host'); };
    const value = Reflect.get(instance, key, instance);
    if (typeof value === 'function') return (...args: unknown[]) => {
      const result = value.apply(instance, args);
      return result && typeof result === 'object' && ('compile' in result || 'toOperationNode' in result || 'executeQuery' in result || 'execute' in result)
        ? compilationOnly(result) : result;
    };
    return value && typeof value === 'object' && key === 'schema' ? compilationOnly(value) : value;
  } });
}
const physicalNames = new Set(Object.values(names));
/** Trusted synchronous planning on an existing owner. Execution stays unavailable. */
export function seedDomainPlanCompiler(db: Kysely<any>): Kysely<any> {
  const context = views.get(db);
  if (!context) throw new Error('Seed domain planning requires its actual registered query handle');
  return compilationOnly(context.atomicLogical.withPlugin(namespace));
}
function allowedMutationTable(node: OperationNode | undefined): boolean {
  const name = tableName(node);
  return name !== undefined && (physicalNames.has(name) || /^ec_[a-z][a-z0-9_]{0,63}$/.test(name));
}
function assertAtomicPlan(query: RootOperationNode): void {
  if (query.kind === 'InsertQueryNode' && !query.with && allowedMutationTable(query.into)) return;
  if (query.kind === 'UpdateQueryNode' && !query.with && !query.from && !query.joins && allowedMutationTable(query.table)) return;
  if (query.kind === 'DeleteQueryNode' && !query.with && !query.using && query.from.froms.length === 1 && allowedMutationTable(query.from.froms[0])) return;
  // Only dynamic content schema is in this plan seam; fixed provider DDL remains separate.
  if (query.kind === 'CreateTableNode' || query.kind === 'AlterTableNode' || query.kind === 'DropTableNode') {
    if (/^ec_[a-z][a-z0-9_]{0,63}$/.test(tableName(query.table) ?? '')) return;
  }
  if (query.kind === 'CreateIndexNode' && /^ec_[a-z][a-z0-9_]{0,63}$/.test(tableName(query.table) ?? '')) return;
  throw new Error('Seed atomic plan requires a qualified typed domain mutation; raw capture DDL is incomplete');
}
/** Proposal only: Source observers run once during compilation; the existing host commits the complete list. */
export async function seedAtomicBatch(
  database: CmsDatabase,
  db: Kysely<any>,
  build: (db: Kysely<any>) => readonly (Compilable | RawBuilder<unknown>)[],
): Promise<readonly QueryResult<unknown>[]> {
  const context = views.get(db);
  if (!context || context.owner !== database) throw new Error('Seed atomic plans require the exact real owner');
  if (db.isTransaction) throw new Error('Nested native atomic batches are not qualified');
  const planning = compilationOnly(context.atomicLogical.withPlugin(namespace));
  const statements = build(planning).map(query => 'isRawBuilder' in query ? query.compile(planning) : query.compile());
  for (const statement of statements) {
    assertAtomicPlan(statement.query);
    if (statement.parameters.length > 100) throw new Error('Seed atomic statement exceeds the 100-binding D1 limit');
  }
  return database.atomicBatch(statements);
}
