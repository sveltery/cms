// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// Exact pinned Source pure capture declarations; Native fixed-plan compiler only.
import {sql,type RawBuilder} from "kysely";
import {validateIdentifier} from "../database/lifecycle/upstream/database/validate.ts";
const POSTGRES_IDENTIFIER_LIMIT = 63;

const CAPTURE_TRIGGER_VERSION = 1;

const WHITESPACE_PATTERN = /\s+/g;

const TRAILING_SEMICOLON_PATTERN = /;$/;

export interface MediaUsageCaptureIdentity {
	collectionId: string;
	collectionSlug: string;
}

type CaptureOperation = "insert" | "update" | "delete";

const captureOperations: readonly CaptureOperation[] = ["insert", "update", "delete"];

async function captureIdentifiers(identity: MediaUsageCaptureIdentity): Promise<{
	tableName: string;
	triggerNames: Record<CaptureOperation, string>;
}> {
	validateIdentifier(identity.collectionSlug, "collection slug");
	const tableName = `ec_${identity.collectionSlug}`;
	validateIdentifier(tableName, "content table");

	const digest = await identityDigest(
		`${CAPTURE_TRIGGER_VERSION}:${identity.collectionId}:${identity.collectionSlug}`,
	);
	const triggerNames = {
		insert: `emdash_mu_${digest}_ai`,
		update: `emdash_mu_${digest}_au`,
		delete: `emdash_mu_${digest}_ad`,
	};
	for (const triggerName of Object.values(triggerNames)) {
		validateIdentifier(triggerName, "media usage trigger");
		if (triggerName.length > POSTGRES_IDENTIFIER_LIMIT) {
			throw new Error(`Media usage trigger name exceeds ${POSTGRES_IDENTIFIER_LIMIT} bytes`);
		}
	}

	return { tableName, triggerNames };
}

async function identityDigest(value: string): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
	return Array.from(new Uint8Array(digest).slice(0, 16), (byte) =>
		byte.toString(16).padStart(2, "0"),
	).join("");
}

function normalizeDdl(definition: string): string {
	return definition.replace(WHITESPACE_PATTERN, " ").trim().replace(TRAILING_SEMICOLON_PATTERN, "");
}

function sqliteTriggerSql(
	tableName: string,
	triggerName: string,
	operation: RawBuilder<unknown>,
	contentId: RawBuilder<unknown>,
	identity: MediaUsageCaptureIdentity,
): RawBuilder<unknown> {
	return sql`
		CREATE TRIGGER ${sql.ref(triggerName)}
		AFTER ${operation} ON ${sql.ref(tableName)}
		FOR EACH ROW
		BEGIN
			UPDATE _emdash_media_usage_index_status
			SET change_epoch = change_epoch + 1,
				status = CASE WHEN status = 'complete' THEN 'stale' ELSE status END,
				completed_at = CASE WHEN status = 'complete' THEN NULL ELSE completed_at END,
				updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
			WHERE adapter_id = 'content-media'
				AND scope_type = 'collection'
				AND scope_key = ${sql.lit(identity.collectionSlug)}
				AND collection_id = ${sql.lit(identity.collectionId)}
				AND capture_state = 'active'
				AND EXISTS (
					SELECT 1
					FROM _emdash_collections AS collection
					WHERE collection.id = ${sql.lit(identity.collectionId)}
						AND collection.slug = ${sql.lit(identity.collectionSlug)}
				);

			SELECT CASE
				WHEN changes() <> 1 THEN RAISE(ABORT, 'media usage capture inactive')
			END;

			INSERT INTO _emdash_media_usage_work (
				collection_id,
				collection_slug,
				content_id,
				change_epoch,
				work_version,
				state,
				attempt_count,
				next_attempt_at,
				lease_token,
				lease_expires_at,
				last_attempted_at,
				last_error_code,
				created_at,
				updated_at
			)
			SELECT
				${sql.lit(identity.collectionId)},
				${sql.lit(identity.collectionSlug)},
				${contentId},
				change_epoch,
				1,
				'pending',
				0,
				strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
				NULL,
				NULL,
				NULL,
				NULL,
				strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
				strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
			FROM _emdash_media_usage_index_status
			WHERE adapter_id = 'content-media'
				AND scope_type = 'collection'
				AND scope_key = ${sql.lit(identity.collectionSlug)}
				AND collection_id = ${sql.lit(identity.collectionId)}
				AND capture_state = 'active'
			ON CONFLICT (collection_id, content_id) DO UPDATE SET
				collection_slug = excluded.collection_slug,
				change_epoch = excluded.change_epoch,
				work_version = _emdash_media_usage_work.work_version + 1,
				state = 'pending',
				attempt_count = 0,
				next_attempt_at = excluded.next_attempt_at,
				lease_token = NULL,
				lease_expires_at = NULL,
				last_attempted_at = NULL,
				last_error_code = NULL,
				updated_at = excluded.updated_at;
		END
	`;
}

function operationSql(operation: CaptureOperation): RawBuilder<unknown> {
	switch (operation) {
		case "insert":
			return sql`INSERT`;
		case "update":
			return sql`UPDATE`;
		case "delete":
			return sql`DELETE`;
	}
}

export {captureIdentifiers,sqliteTriggerSql,operationSql,normalizeDdl,captureOperations};
