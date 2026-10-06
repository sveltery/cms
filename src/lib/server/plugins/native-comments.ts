import type { Kysely } from 'kysely';
import { CommentRepository as CanonicalCommentRepository } from '../comments/upstream/database/repositories/comment.ts';
import { nativeCommentDatabase } from '../comments/runtime.ts';
import type { Database } from './database-types.ts';
import { pluginDatabaseOwner } from './database.ts';
export class CommentRepository extends CanonicalCommentRepository {
  constructor(db: Kysely<Database>) { super(nativeCommentDatabase(pluginDatabaseOwner(db))); }
}
export type { Comment } from '../comments/upstream/database/repositories/comment.ts';
