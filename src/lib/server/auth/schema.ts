import { sql, type Kysely, type CompiledQuery } from 'kysely';

export type AuthTables = {
  _cms_auth_users: { id: string; role: number; disabled: number };
  _cms_auth_sessions: { hash: string; user_id: string; expires_at: number };
};
/** Empty auth-only tables registered atomically by migrateCms version two. */
export function authSchemaStatements(db: Kysely<AuthTables>): CompiledQuery[] {
  return [
    sql`CREATE TABLE _cms_auth_users (
      id TEXT PRIMARY KEY NOT NULL CHECK(length(id) > 0),
      role INTEGER NOT NULL CHECK(role IN (10, 20, 30, 40, 50)),
      disabled INTEGER NOT NULL CHECK(disabled IN (0, 1))
    )`.compile(db),
    sql`CREATE TABLE _cms_auth_sessions (
      hash TEXT PRIMARY KEY NOT NULL CHECK(length(hash) = 43),
      user_id TEXT NOT NULL REFERENCES _cms_auth_users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL CHECK(expires_at > 0)
    )`.compile(db),
    sql`CREATE INDEX idx_cms_auth_sessions_user ON _cms_auth_sessions(user_id)`.compile(db)
  ];
}
