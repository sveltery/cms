// EmDash 1.1.0 MIT, Copyright 2026 Cloudflare Inc.; see notices/emdash-MIT.txt.
// Derived from immutable 027_comments.ts and 044_comment_reactions.ts.
// These complete descriptors do not register migrations or install request storage.
import { sql, type CompiledQuery, type Kysely } from 'kysely';

export const commentSchemaSql = [
  `CREATE TABLE _cms_comments (
    id TEXT PRIMARY KEY, collection TEXT NOT NULL, content_id TEXT NOT NULL,
    parent_id TEXT REFERENCES _cms_comments(id) ON DELETE CASCADE,
    author_name TEXT NOT NULL, author_email TEXT NOT NULL, author_url TEXT,
    author_user_id TEXT REFERENCES _cms_auth_users(id) ON DELETE SET NULL,
    body TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', ip_hash TEXT,
    user_agent TEXT, moderation_metadata TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`,
  'CREATE INDEX idx_comments_content ON _cms_comments (collection, content_id, status)',
  'CREATE INDEX idx_comments_parent ON _cms_comments (parent_id)',
  'CREATE INDEX idx_comments_status ON _cms_comments (status, created_at)',
  'CREATE INDEX idx_comments_author_email ON _cms_comments (author_email)',
  'CREATE INDEX idx_comments_author_user ON _cms_comments (author_user_id)',
  `CREATE TABLE _cms_comment_reactions (
    id TEXT PRIMARY KEY, comment_id TEXT NOT NULL REFERENCES _cms_comments(id) ON DELETE CASCADE,
    reaction TEXT NOT NULL DEFAULT 'like', voter_hash TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`,
  'CREATE UNIQUE INDEX idx_comment_reactions_unique ON _cms_comment_reactions (comment_id, voter_hash, reaction)',
  'CREATE INDEX idx_comment_reactions_comment ON _cms_comment_reactions (comment_id)',
  'CREATE INDEX idx_comment_reactions_voter ON _cms_comment_reactions (voter_hash, created_at)'
] as const;

export function commentSchemaStatements<DB>(db: Kysely<DB>): CompiledQuery[] {
  return commentSchemaSql.map(statement => sql.raw(statement).compile(db));
}
