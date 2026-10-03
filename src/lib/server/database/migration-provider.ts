import type { CompiledQuery } from 'kysely';
import type { CmsDatabase } from './contract.ts';

export interface MigrationObject { name: string; type: 'table' | 'index'; sql: string }
/** Versions are contiguous and immutable. Later providers may replace an object's descriptor. */
export interface CmsMigrationProvider {
  readonly version: number;
  readonly name: string;
  statements(database: CmsDatabase): Promise<readonly CompiledQuery[]>;
  /** Version zero declares this provider's static names/DDL without metadata reads. */
  expectedObjects(database: CmsDatabase, installedVersion?: number): Promise<readonly MigrationObject[]>;
}
export function migrationObjects(statements: readonly CompiledQuery[]): MigrationObject[] {
  return statements.flatMap(statement => {
    const match = /^CREATE\s+(?:UNIQUE\s+)?(TABLE|INDEX)\s+([\w"]+)/i.exec(statement.sql.trim());
    return match ? [{ name: match[2].replaceAll('"', ''), type: match[1].toLowerCase() as 'table' | 'index', sql: statement.sql }] : [];
  });
}
export const normalizeMigrationSql = (value: string) => value.trim().replace(/"([\w]+)"/g, '$1').replace(/\s+/g, ' ');
