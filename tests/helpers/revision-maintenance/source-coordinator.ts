// @ts-nocheck -- complete pinned callbacks; test-only framework and namespace host.
// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// EmDash 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; provenance: docs/revision-maintenance-ports.json.
import type {Kysely} from 'kysely';
import {RevisionRepository} from './source-revision.ts';
import type {Database} from '../../../src/lib/server/database/lifecycle/upstream/database/types.ts';
const REVISION_KEEP_COUNT=50;
const REVISION_PRUNE_BATCH_SIZE=10;
export async function pruneQueuedRevisions(db: Kysely<Database>): Promise<number> {
	const queued = await db
		.selectFrom("_emdash_revision_prune_queue")
		.selectAll()
		.orderBy("revision_id")
		.limit(REVISION_PRUNE_BATCH_SIZE)
		.execute();
	const revisionRepo = new RevisionRepository(db);
	let totalPruned = 0;

	for (const row of queued) {
		try {
			totalPruned += await revisionRepo.pruneQueuedEntry(
				row.collection,
				row.entry_id,
				row.revision_id,
				REVISION_KEEP_COUNT,
			);
		} catch (error) {
			console.error(
				`[cleanup] Failed to prune revisions for ${row.collection}/${row.entry_id}:`,
				error,
			);
		}
	}

	return totalPruned;
}
