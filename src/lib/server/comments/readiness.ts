import { sql } from 'kysely';
import type { CmsDatabase } from '../database/contract.ts';
import { commentSchemaSql } from './migrations.ts';
import { commentRuntimeSchemaSql } from './runtime-migrations.ts';

type SqlToken = { text: string; quotedIdentifier?: string };
const ownedIdentifiers = new Set([
  '_cms_comments', '_cms_comment_reactions', '_cms_comment_options', '_cms_comment_rate_limits', '_cms_auth_users',
  'id', 'collection', 'content_id', 'parent_id', 'author_name', 'author_email', 'author_user_id', 'body', 'status',
  'ip_hash', 'user_agent', 'moderation_metadata', 'created_at', 'updated_at', 'comment_id', 'reaction', 'voter_hash',
  'name', 'value', 'revision', 'key', 'window', 'count', 'pk_comment_rate_limits',
  ...[...commentSchemaSql, ...commentRuntimeSchemaSql].map(statement => /^CREATE (?:UNIQUE )?(?:TABLE|INDEX|TRIGGER) (\w+)/.exec(statement)![1])
]);
/** SQLite whitespace excludes NBSP and vertical tab. Every token boundary is retained. */
function schemaTokens(value: string): SqlToken[] {
  const tokens: SqlToken[] = [];
  for (let index = 0; index < value.length;) {
    const character = value[index];
    if (/[ \t\n\f\r]/.test(character)) { index++; continue; }
    if (character === "'" || character === '"' || character === '`' || character === '[') {
      const start = index++;
      const closing = character === '[' ? ']' : character;
      let content = '';
      while (index < value.length) {
        const next = value[index++];
        if (next !== closing) { content += next; continue; }
        if (character !== '[' && value[index] === closing) { content += closing; index++; continue; }
        break;
      }
      tokens.push({ text: value.slice(start, index), ...(character === "'" ? {} : { quotedIdentifier: content.replace(/[A-Z]/g, letter => letter.toLowerCase()) }) });
    } else if (/[A-Za-z0-9_\u0080-\uffff]/.test(character)) {
      const start = index++;
      while (index < value.length && /[A-Za-z0-9_\u0080-\uffff]/.test(value[index])) index++;
      tokens.push({ text: value.slice(start, index).replace(/[A-Z]/g, letter => letter.toLowerCase()) });
    } else {
      tokens.push({ text: character });
      index++;
    }
  }
  return tokens;
}
/** Quoted tokens remain exact unless the reference places a known owned identifier there. */
export function normalizeCommentSchemaSql(value: string, reference?: string): string {
  const tokens = schemaTokens(value);
  const expectedTokens = reference === undefined ? undefined : schemaTokens(reference);
  return JSON.stringify(tokens.map((token, index) => {
    const expectedToken = expectedTokens?.[index];
    // PRIMARY KEY is syntax; the separately declared rate-limit key is an identifier.
    const identifierPosition = expectedToken && ownedIdentifiers.has(expectedToken.text)
      && !(expectedToken.text === 'key' && expectedTokens?.[index - 1]?.text === 'primary');
    return identifierPosition && token.quotedIdentifier === expectedToken.text ? expectedToken.text : token.text;
  }));
}
const normalize = normalizeCommentSchemaSql;
const expected = new Map([...commentSchemaSql, ...commentRuntimeSchemaSql].map(statement => {
  const match = /^CREATE (?:UNIQUE )?(TABLE|INDEX|TRIGGER) (\w+)/.exec(statement)!;
  return [match[2], { type: match[1].toLowerCase(), sql: statement }];
}));

/** One read-only schema census; no migrations, writes or cross-request memoization. */
export async function commentsReady(database: CmsDatabase): Promise<boolean> {
  const rows = (await sql<{ name: string; type: string; tbl_name: string; sql: string | null }>`
    SELECT name, type, tbl_name, sql FROM sqlite_schema
    WHERE tbl_name IN ('_cms_comments', '_cms_comment_reactions', '_cms_comment_options', '_cms_comment_rate_limits')
    UNION ALL
    SELECT name, 'column', type, dflt_value FROM pragma_table_info('_cms_collections')
    WHERE name IN ('comments_enabled', 'comments_moderation', 'comments_closed_after_days', 'comments_auto_approve_users')
  `.execute(database.db)).rows;
  const settings = new Map([
    ['comments_enabled', { type: 'INTEGER', value: '0' }],
    ['comments_moderation', { type: 'TEXT', value: "'first_time'" }],
    ['comments_closed_after_days', { type: 'INTEGER', value: '90' }],
    // The approved native canonical schema currently defaults this to 0.
    // Source 027 defaults it to 1; retain that existing difference explicitly
    // rather than altering canonical ownership from a request-readiness check.
    ['comments_auto_approve_users', { type: 'INTEGER', value: '0' }]
  ]);
  const collectionColumns = rows.filter(row => row.type === 'column');
  if (collectionColumns.length !== settings.size || !collectionColumns.every(row => {
    const source = settings.get(row.name);
    return source && row.tbl_name.replace(/[a-z]/g, letter => letter.toUpperCase()) === source.type && row.sql !== null && normalize(row.sql) === normalize(source.value);
  })) return false;
  const actual = rows.filter(row => row.type !== 'column' && !row.name.startsWith('sqlite_autoindex_'));
  if (actual.length !== expected.size) return false;
  return actual.every(row => {
    const source = expected.get(row.name);
    return source && row.type === source.type && row.sql !== null && normalize(row.sql, source.sql) === normalize(source.sql);
  });
}
