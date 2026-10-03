// EmDash MIT Cloudflare 2026; exact Source001/032/077 owned comment dependency subset.
// The complete declarations remain unregistered, for explicit fixtures and read-only readiness.
import { sql, type CompiledQuery, type Kysely } from 'kysely';
export const commentRuntimeSchemaSql = [
 "CREATE TABLE _cms_comment_options (name TEXT PRIMARY KEY, value TEXT NOT NULL, revision TEXT NOT NULL DEFAULT '0')",
 "CREATE TRIGGER cms_comment_options_revision_insert AFTER INSERT ON _cms_comment_options WHEN NEW.revision = '0' BEGIN UPDATE _cms_comment_options SET revision = lower(hex(randomblob(16))) WHERE name = NEW.name AND revision = NEW.revision; END",
 "CREATE TRIGGER cms_comment_options_revision_update AFTER UPDATE ON _cms_comment_options WHEN NEW.revision = '0' OR NEW.revision = OLD.revision BEGIN UPDATE _cms_comment_options SET revision = lower(hex(randomblob(16))) WHERE name = NEW.name AND revision = NEW.revision; END",
 'CREATE TABLE _cms_comment_rate_limits (key TEXT NOT NULL, window TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 1, CONSTRAINT pk_comment_rate_limits PRIMARY KEY (key, window))',
 'CREATE INDEX idx_comment_rate_limits_window ON _cms_comment_rate_limits (window)'
] as const;
export function commentRuntimeSchemaStatements<DB>(db: Kysely<DB>): CompiledQuery[] {
 return commentRuntimeSchemaSql.map(statement=>sql.raw(statement).compile(db));
}
