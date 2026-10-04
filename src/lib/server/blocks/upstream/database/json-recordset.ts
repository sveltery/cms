// EmDash 1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; whole Source packages/core/src/database/json-recordset.ts.
// Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
// Host adaptations are explicitly inventoried in the block registry proposal.
import { sql, type Kysely, type RawBuilder } from "kysely";

import { isPostgres } from "./dialect-helpers.ts";
import type { Database } from "./types.ts";

export function jsonTextValues(
	db: Kysely<Database>,
	values: readonly string[],
): RawBuilder<{ value: string }> {
	const payload = JSON.stringify([...new Set(values)]);
	return isPostgres(db)
		? sql<{
				value: string;
			}>`SELECT value::text AS value FROM jsonb_array_elements_text(${payload}::jsonb) AS value`
		: sql<{ value: string }>`SELECT value AS value FROM json_each(${payload})`;
}
