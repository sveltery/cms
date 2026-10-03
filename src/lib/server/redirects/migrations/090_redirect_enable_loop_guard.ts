// EmDash 1.1.0 MIT, Copyright 2026 Cloudflare Inc.; see notices/emdash-MIT.txt.
// Source 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e:packages/core/src/database/migrations/090_redirect_enable_loop_guard.ts; blob e2aa2ddb7bfc482b4ac1f421576102f11fd1062a.
import { type Kysely, sql } from "kysely";

import { isPostgres } from "../../database/lifecycle/upstream/database/dialect-helpers.ts";

/**
 * Rejects enabling a disabled redirect when its edge would close a loop.
 * The loop guards from 081 only fire when source or destination changes.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
	if (isPostgres(db)) {
		await sql`
			CREATE OR REPLACE FUNCTION emdash_redirect_validate_enable()
			RETURNS trigger
			LANGUAGE plpgsql
			AS $$
			BEGIN
				PERFORM pg_advisory_xact_lock(1168624763);
				IF EXISTS (
					WITH RECURSIVE chain(source, destination) AS (
						SELECT source, destination FROM _cms_redirects
						WHERE source = NEW.destination AND enabled = 1 AND id <> NEW.id
						UNION
						SELECT redirect.source, redirect.destination
						FROM _cms_redirects AS redirect
						JOIN chain ON redirect.source = chain.destination
						WHERE redirect.enabled = 1 AND redirect.id <> NEW.id
					)
					SELECT 1 FROM chain WHERE destination = NEW.source
				) THEN
					RAISE EXCEPTION 'redirect loop';
				END IF;
				RETURN NEW;
			END;
			$$
		`.execute(db);
		await sql`DROP TRIGGER IF EXISTS emdash_redirect_loop_enable ON _cms_redirects`.execute(db);
		await sql`
			CREATE TRIGGER emdash_redirect_loop_enable
			BEFORE UPDATE OF enabled ON _cms_redirects
			FOR EACH ROW
			WHEN (NEW.enabled = 1 AND OLD.enabled IS DISTINCT FROM 1 AND NEW.destination <> '')
			EXECUTE FUNCTION emdash_redirect_validate_enable()
		`.execute(db);
		return;
	}

	// No `CASE ... END;` inside trigger bodies: the D1 HTTP API used by
	// `emdash migrate` ends the statement at an inner `END;`.
	await sql`
		CREATE TRIGGER IF NOT EXISTS emdash_redirect_loop_enable
		BEFORE UPDATE OF enabled ON _cms_redirects
		WHEN NEW.enabled = 1 AND OLD.enabled IS NOT 1 AND NEW.destination <> ''
		BEGIN
			SELECT RAISE(ABORT, 'redirect loop') WHERE EXISTS (
				WITH RECURSIVE chain(source, destination) AS (
					SELECT source, destination FROM _cms_redirects
					WHERE source = NEW.destination AND enabled = 1 AND id <> NEW.id
					UNION
					SELECT redirect.source, redirect.destination
					FROM _cms_redirects AS redirect
					JOIN chain ON redirect.source = chain.destination
					WHERE redirect.enabled = 1 AND redirect.id <> NEW.id
				)
				SELECT 1 FROM chain WHERE destination = NEW.source
			);
		END
	`.execute(db);
}

export async function down(_db: Kysely<unknown>): Promise<void> {}
