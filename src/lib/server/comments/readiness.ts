import { sql } from 'kysely';
import type { CmsDatabase } from '../database/contract.ts';
import { commentSchemaSql } from './migrations.ts';

const normalize = (value: string) => value.replaceAll('"', '').replaceAll('`', '').replace(/\s+/g, '').toLowerCase();
const expected = new Map(commentSchemaSql.map(statement => {
  const match = /^CREATE (?:UNIQUE )?(TABLE|INDEX) (\w+)/.exec(statement)!;
  return [match[2], { type: match[1].toLowerCase(), sql: normalize(statement) }];
}));

/** One read-only schema census; no migrations, writes or cross-request memoization. */
export async function commentsReady(database: CmsDatabase): Promise<boolean> {
  const rows = (await sql<{ name: string; type: string; tbl_name: string; sql: string | null }>`
    SELECT name, type, tbl_name, sql FROM sqlite_schema
    WHERE tbl_name IN ('_cms_comments', '_cms_comment_reactions')
  `.execute(database.db)).rows;
  if (rows.length === 0) return false;
  const actual = rows.filter(row => !row.name.startsWith('sqlite_autoindex_'));
  if (actual.length !== expected.size) return false;
  return actual.every(row => {
    const source = expected.get(row.name);
    return source && row.type === source.type && row.sql !== null && normalize(row.sql) === source.sql;
  });
}
