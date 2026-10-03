import { sql } from 'kysely';
import type { CmsDatabase } from '../database/contract.ts';
import { commentSchemaSql } from './migrations.ts';

/** Fold SQL syntax outside string literals; literal values remain byte-exact. */
export function normalizeCommentSchemaSql(value: string): string {
  let result = '';
  for (let index = 0; index < value.length;) {
    const character = value[index];
    if (character === "'") {
      const start = index++;
      while (index < value.length) {
        if (value[index++] !== "'") continue;
        if (value[index] === "'") { index++; continue; }
        break;
      }
      result += value.slice(start, index);
    } else if (character === '"' || character === '`' || character === '[') {
      const closing = character === '[' ? ']' : character;
      index++;
      while (index < value.length) {
        if (value[index] === closing) {
          index++;
          if (value[index] === closing) { result += closing; index++; continue; }
          break;
        }
        result += value[index++].toLowerCase();
      }
    } else {
      if (!/\s/.test(character)) result += character.toLowerCase();
      index++;
    }
  }
  return result;
}
const normalize = normalizeCommentSchemaSql;
const expected = new Map(commentSchemaSql.map(statement => {
  const match = /^CREATE (?:UNIQUE )?(TABLE|INDEX) (\w+)/.exec(statement)!;
  return [match[2], { type: match[1].toLowerCase(), sql: normalize(statement) }];
}));

/** One read-only schema census; no migrations, writes or cross-request memoization. */
export async function commentsReady(database: CmsDatabase): Promise<boolean> {
  const rows = (await sql<{ name: string; type: string; tbl_name: string; sql: string | null }>`
    SELECT name, type, tbl_name, sql FROM sqlite_schema
    WHERE tbl_name IN ('_cms_comments', '_cms_comment_reactions')
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
    return source && row.tbl_name.toUpperCase() === source.type && row.sql !== null && normalize(row.sql) === source.value;
  })) return false;
  const actual = rows.filter(row => row.type !== 'column' && !row.name.startsWith('sqlite_autoindex_'));
  if (actual.length !== expected.size) return false;
  return actual.every(row => {
    const source = expected.get(row.name);
    return source && row.type === source.type && row.sql !== null && normalize(row.sql) === source.sql;
  });
}
