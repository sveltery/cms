// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// Pin913cb1bb9b7f08c3ff0d258b4420e53835b6a58e: whole Source MediaRepository.count and its three pure helpers.
// User count retains only Source no-argument COUNT(id); no user CRUD/role-filter credit.
import { sql, type Kysely, type ExpressionBuilder, type SqlBool } from 'kysely';
import type { Database } from './database-types.ts';

/** Escape LIKE wildcard characters and the escape char itself in user-supplied values */
function escapeLike(value: string): string {
	return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}

/**
 * Normalize a mimeType filter (string or array) into a clean string[].
 * Entries that are empty strings are dropped.
 */
function normalizeMimeFilter(input?: string | readonly string[]): string[] {
	if (!input) return [];
	const arr = Array.isArray(input) ? input : [input];
	return arr
		.filter((entry): entry is string => typeof entry === "string" && entry.length > 0)
		.map((entry) =>
			entry.endsWith("/") ? entry.toLowerCase() : entry.split(";")[0].trim().toLowerCase(),
		);
}

/**
 * Build a WHERE clause that matches `mime_type` against any of the given
 * filter entries — exact equality for full MIMEs, LIKE prefix for entries
 * ending in "/".
 */
function mimeMatchExpr(eb: ExpressionBuilder<Database, "media">, filters: string[]) {
	return eb.or(
		filters.map((entry) =>
			entry.endsWith("/")
				? sql<SqlBool>`mime_type LIKE ${`${escapeLike(entry)}%`} ESCAPE '\\'`
				: eb("mime_type", "=", entry),
		),
	);
}

/** Bounded actual media SQL count only; missing physical media storage throws. */
export class MediaRepository {
  constructor(private readonly db: Kysely<Database>) {}
  /**
	 * Count media items
	 */
	async count(mimeType?: string | readonly string[]): Promise<number> {
		const filters = normalizeMimeFilter(mimeType);
		let query = this.db.selectFrom("media").select((eb) => eb.fn.count<number>("id").as("count"));

		if (filters.length > 0) {
			query = query.where((eb) => mimeMatchExpr(eb, filters));
		}

		const result = await query.executeTakeFirst();
		return Number(result?.count || 0);
	}
}

/** Dashboard passes no role filter; count every actual persisted auth user ID. */
export class UserRepository {
  constructor(private readonly db: Kysely<Database>) {}
  async count(): Promise<number> {
    const result = await this.db.selectFrom('users')
      .select(eb => eb.fn.count('id').as('count')).executeTakeFirst();
    return Number(result?.count || 0);
  }
}
