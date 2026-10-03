// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// EmDash 1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; cleanup.ts blob 21d6eabd50e690faac77865746c2c3b3c4c7ab44.
// Complete pruneQueuedRevisions function; only namespace/module host substitutions.
import type {Kysely} from 'kysely';
import {RevisionRepository} from '../database/lifecycle/upstream/database/repositories/revision.ts';
import type {Database} from '../database/lifecycle/upstream/database/types.ts';
const REVISION_KEEP_COUNT=50;
const REVISION_PRUNE_BATCH_SIZE=10;
export async function pruneQueuedRevisions(db: Kysely<Database>): Promise<number> {
	const queued = await db
		.selectFrom("_cms_revision_prune_queue")
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
