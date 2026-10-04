import type { CompiledQuery } from 'kysely';
import type { CmsDatabase } from './contract.ts';

export interface MigrationObject { name: string; type: 'table' | 'index'; sql: string }
export interface MigrationTrigger { name: string; type: 'trigger'; sql: string }
export interface PreparedCmsMigration {
  /** All guards execute before the first ordinary startup write. */
  readonly guards: readonly CompiledQuery[];
  readonly statements: readonly CompiledQuery[];
}
/** Versions are contiguous and immutable. Later providers may replace an object's descriptor. */
export interface CmsMigrationProvider {
  readonly version: number;
  readonly name: string;
  statements(database: CmsDatabase): Promise<readonly CompiledQuery[]>;
  /** Optional single-snapshot plan for data-dependent later providers. */
  prepare?(database: CmsDatabase): Promise<PreparedCmsMigration>;
  /** Version zero declares this provider's static names/DDL without metadata reads. */
  expectedObjects(database: CmsDatabase, installedVersion?: number): Promise<readonly MigrationObject[]>;
  /** Exact static trigger ownership; absent providers own no triggers. */
  expectedTriggers?(database: CmsDatabase): Promise<readonly MigrationTrigger[]>;
}
export function migrationObjects(statements: readonly CompiledQuery[]): MigrationObject[] {
  return statements.flatMap(statement => {
    const match = /^CREATE\s+(?:UNIQUE\s+)?(TABLE|INDEX)\s+([\w"]+)/i.exec(statement.sql.trim());
    return match ? [{ name: match[2].replaceAll('"', ''), type: match[1].toLowerCase() as 'table' | 'index', sql: statement.sql }] : [];
  });
}
// Finite identifiers from the complete frozen 1–5 and proposed 6–8 descriptors.
// Literals, timestamp expressions and arbitrary quoted tokens remain distinct.
const nativeSchemaIdentifiers = new Set([
  'NEW', 'OLD', '_cms_migrations', '_cms_auth_challenges', '_cms_auth_credentials', '_cms_auth_profiles', '_cms_auth_rate_limits',
  '_cms_auth_sessions', '_cms_auth_setup', '_cms_auth_users', '_cms_collections', '_cms_content_taxonomies', '_cms_fields',
  '_cms_guards', '_cms_options', '_cms_options_revision_insert', '_cms_options_revision_update', '_cms_plugin_indexes', '_cms_plugin_state',
  '_cms_plugin_storage', '_cms_plugin_storage_revision_insert', '_cms_plugin_storage_revision_update', '_cms_revision_prune_queue', '_cms_revisions', '_cms_taxonomies',
  '_cms_taxonomy_def_groups', '_cms_taxonomy_defs', 'activated_at', 'admin_config', 'algorithm', 'author_id',
  'avatar_url', 'backed_up', 'challenge', 'collection', 'collection_id', 'collections',
  'column_type', 'comments_auto_approve_users', 'comments_closed_after_days', 'comments_enabled', 'comments_moderation', 'count',
  'counter', 'created_at', 'data', 'date_field', 'deactivated_at', 'default_value',
  'deleted_at', 'description', 'device_type', 'disabled', 'display_name', 'edit_locking',
  'email', 'email_verified', 'entry_id', 'expires_at', 'fields', 'has_seo',
  'hash', 'hidden', 'hierarchical', 'icon', 'id', 'idx_cms_auth_challenges_expires',
  'idx_cms_auth_credentials_user', 'idx_cms_auth_sessions_user', 'idx_cms_content_taxonomies_group_lookup', 'idx_cms_content_taxonomies_term', 'idx_cms_fields_collection', 'idx_cms_plugin_state_registry',
  'idx_cms_plugin_state_source', 'idx_cms_plugin_storage_list', 'idx_cms_revision_prune_queue_revision_id', 'idx_cms_revisions_entry', 'idx_cms_taxonomies_locale', 'idx_cms_taxonomies_name_locale',
  'idx_cms_taxonomies_parent', 'idx_cms_taxonomies_translation_group', 'idx_cms_taxonomies_translation_group_locale_unique', 'idx_cms_taxonomy_defs_locale', 'idx_cms_taxonomy_defs_translation_group', 'index_name',
  'indexed', 'installed_at', 'key', 'label', 'label_singular', 'last_used_at',
  'locale', 'marketplace_version', 'mcp_tools_consent', 'mcp_tools_enabled', 'name', 'nav_group',
  'options', 'parent_id', 'pass', 'plugin_id', 'public_key', 'published_at',
  'registry_publisher_did', 'registry_slug', 'required', 'revision', 'revision_id', 'role',
  'routable', 'scheduled_at', 'search_config', 'searchable', 'slug', 'sort_order',
  'source', 'status', 'supports', 'taxonomy_id', 'title_field', 'token',
  'translatable', 'translation_group', 'transports', 'type', 'unique', 'updated_at',
  'url_pattern', 'user_id', 'validation', 'value', 'version', 'widget',
  'window',
  // Common generated content columns use the same fixed native schema.
  'status', 'author_id', 'locale', 'published_at', 'scheduled_at', 'deleted_at',
  'live_revision_id', 'draft_revision_id', 'translation_group'
]);
export function normalizeMigrationSql(value: string): string {
  // SQLite has only five whitespace characters. Preserve literals/comments and
  // tokens such as NBSP or vertical tab, which are not SQL whitespace.
  const whitespace = /^[ \t\r\n\f]+$/;
  const tokens = value.match(/--[^\r\n]*|\/\*[\s\S]*?\*\/|'(?:''|[^'])*'|"(?:""|[^"])*"|`(?:``|[^`])*`|\[[^\]]*\]|[ \t\r\n\f]+|[A-Za-z_][A-Za-z_0-9$]*|[\s\S]/g) ?? [];
  const significant = tokens.filter(token => !whitespace.test(token));
  const contexts: ('columns' | 'identifiers' | 'expression' | 'other')[] = [];
  const identifier = /^[A-Za-z_][A-Za-z_0-9$]*$/;
  const columnType = /^(?:TEXT|INTEGER|REAL|JSON|BLOB|NUMERIC)$/i;
  const tablePosition = /^(?:TABLE|INDEX|TRIGGER|REFERENCES|ON|FROM|JOIN|INTO|UPDATE)$/i;
  const constraints = /^(?:NOT|NULL|UNIQUE|PRIMARY|CHECK|COLLATE|REFERENCES|GENERATED)$/i;
  let defaultDepth: number | undefined;
  let expressionClause = false;
  let index = -1;
  const normalized = tokens.map(token => {
    if (whitespace.test(token)) return ' ';
    index++;
    const previous = significant[index - 1] ?? '';
    const beforePrevious = significant[index - 2] ?? '';
    const next = significant[index + 1] ?? '';
    // Quoted tokens in a DEFAULT are values even when they spell a known
    // schema identifier. End only at the original column/constraint depth.
    if (defaultDepth !== undefined && contexts.length === defaultDepth &&
        (token === ',' || token === ')' || constraints.test(token))) defaultDepth = undefined;
    if (/^DEFAULT$/i.test(token)) defaultDepth = contexts.length;
    if (/^(?:WHERE|WHEN|SET)$/i.test(token)) expressionClause = true;
    if (token === ';' || /^(?:BEGIN|END)$/i.test(token)) expressionClause = false;
    if (token === '(') {
      const kind = /^CHECK$/i.test(previous) ? 'expression' :
        /^UNIQUE$/i.test(previous) || (/^KEY$/i.test(previous) && /^(?:PRIMARY|FOREIGN)$/i.test(beforePrevious)) ||
        /^(?:REFERENCES|ON|INTO)$/i.test(beforePrevious) ? 'identifiers' :
        /^TABLE$/i.test(beforePrevious) ? 'columns' : 'other';
      contexts.push(kind);
      return token;
    }
    if (token === ')') {
      contexts.pop();
      return token;
    }
    if (!token.startsWith('"') || defaultDepth !== undefined) return token;
    const name = token.slice(1, -1);
    if (!identifier.test(name)) return token;
    const context = contexts.at(-1);
    const columnDefinition = (index === 0 || (context === 'columns' && (previous === '(' || previous === ','))) && columnType.test(next);
    const knownColumn = nativeSchemaIdentifiers.has(name) && !/^(?:_cms_|idx_)/.test(name) && name !== 'NEW' && name !== 'OLD';
    // Unquote only proven identifier positions. Arbitrary user field names
    // need definition/list handling; quoted SELECT values remain distinct.
    return columnDefinition || tablePosition.test(previous) || previous === '.' || next === '.' ||
      context === 'identifiers' || ((context === 'expression' || expressionClause) && knownColumn) ? name : token;
  }).join('');
  return normalized.replace(/^[ \t\r\n\f]+|[ \t\r\n\f]+$/g, '');
}
