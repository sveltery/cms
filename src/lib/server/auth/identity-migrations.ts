import { sql, type CompiledQuery, type Kysely } from 'kysely';

/** Additive identity data; existing current-role users/session tables and their DDL remain intact. */
export interface AuthIdentityTables {
  _cms_auth_profiles: { user_id: string; email: string; name: string | null; avatar_url: string | null;
    email_verified: number; data: string | null; created_at: string; updated_at: string };
  _cms_auth_credentials: { id: string; user_id: string; public_key: Uint8Array; algorithm: number;
    counter: number; device_type: string; backed_up: number; transports: string | null; name: string | null;
    created_at: string; last_used_at: string };
  _cms_auth_challenges: { challenge: string; type: string; user_id: string | null; data: string | null;
    expires_at: string; created_at: string };
  _cms_auth_setup: { key: string; value: string };
  _cms_auth_rate_limits: { key: string; window: string; count: number };
}

/** Canonical migrateCms owns version registration and the adapter-proven atomic execution. */
export function authIdentitySchemaStatements<DB>(db: Kysely<DB>): CompiledQuery[] {
  return [
    sql`CREATE TABLE _cms_auth_profiles (
      user_id TEXT PRIMARY KEY NOT NULL REFERENCES _cms_auth_users(id) ON DELETE CASCADE,
      email TEXT NOT NULL UNIQUE, name TEXT, avatar_url TEXT,
      email_verified INTEGER NOT NULL DEFAULT 0, data TEXT,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    )`.compile(db),
    sql`CREATE TABLE _cms_auth_credentials (
      id TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL REFERENCES _cms_auth_users(id) ON DELETE CASCADE,
      public_key BLOB NOT NULL, algorithm INTEGER NOT NULL DEFAULT -7, counter INTEGER NOT NULL DEFAULT 0,
      device_type TEXT NOT NULL, backed_up INTEGER NOT NULL DEFAULT 0, transports TEXT, name TEXT,
      created_at TEXT NOT NULL, last_used_at TEXT NOT NULL
    )`.compile(db),
    sql`CREATE INDEX idx_cms_auth_credentials_user ON _cms_auth_credentials(user_id)`.compile(db),
    sql`CREATE TABLE _cms_auth_challenges (
      challenge TEXT PRIMARY KEY NOT NULL, type TEXT NOT NULL, user_id TEXT, data TEXT,
      expires_at TEXT NOT NULL, created_at TEXT NOT NULL
    )`.compile(db),
    sql`CREATE INDEX idx_cms_auth_challenges_expires ON _cms_auth_challenges(expires_at)`.compile(db),
    sql`CREATE TABLE _cms_auth_setup (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)`.compile(db),
    sql`CREATE TABLE _cms_auth_rate_limits (
      key TEXT NOT NULL, "window" TEXT NOT NULL, count INTEGER NOT NULL,
      PRIMARY KEY (key, "window")
    )`.compile(db)
  ];
}

export function authIdentitySchemaObjects<DB>(db: Kysely<DB>): { name: string; type: 'table' | 'index'; sql: string }[] {
  return authIdentitySchemaStatements(db).map(statement => {
    const match = /^CREATE (TABLE|INDEX) ([a-z_]+)/.exec(statement.sql);
    if (!match) throw new Error('Unexpected identity migration declaration');
    return { name: match[2], type: match[1] === 'TABLE' ? 'table' : 'index', sql: statement.sql };
  });
}
