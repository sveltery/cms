// EmDash1.1.0 immutable913cb1bb9b7f08c3ff0d258b4420e53835b6a58e.
// Copyright2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
// Whole Source body, finite import transport and additive pure export only.
import type { Kysely } from "kysely";

import { RelationRepository } from "./repository.ts";
import { RevisionRepository } from "../database/lifecycle/upstream/database/repositories/revision.ts";
import type { Database } from "../database/lifecycle/upstream/database/types.ts";
import {
	STAGED_REFERENCES_KEY,
	type StagedReferenceBaselines,
	type StagedReferences,
} from "./staged.ts";
import type { ApiResult } from "../menus/api-types.ts";
import { validateOppositeSideLimit, writeReferenceSelection } from "./handlers.ts";
import {
	referenceFieldConstraints,
	validateReferenceSelection,
	type ReferenceFieldConstraints,
} from "./validate-references.ts";

export {
	mergeStagedReferenceBaselines,
	mergeStagedReferences,
	pageStagedGroups,
	readStagedReferenceBaselines,
	readStagedReferences,
	REFERENCE_PAGE_LIMIT,
	REFERENCE_PAGE_MAX_LIMIT,
	STAGED_REFERENCES_BASELINE_KEY,
	STAGED_REFERENCES_KEY,
} from "./staged.ts";
export type {
	PageOfGroups,
	StagedReferenceBaselines,
	StagedReferences,
} from "./staged.ts";

/** One bound field's live selection as translation groups. */
async function liveFieldSelection(
	repo: RelationRepository,
	field: ReferenceFieldConstraints,
	entryGroup: string,
): Promise<string[]> {
	const links =
		field.relationSide === "child"
			? await repo.getParents(field.relation, entryGroup)
			: await repo.getChildren(field.relation, entryGroup);
	return links.map((link) => (field.relationSide === "child" ? link.parentGroup : link.childGroup));
}

/**
 * Re-check what publication is about to make live against the relation's current
 * cardinality.
 *
 * A draft can sit unpublished across a schema edit that makes its field required
 * or narrows the relation's limits, and across another entry claiming what it
 * selected. It is publication — not the save that staged it — that has to hold
 * the line on both ends. So this walks the collection's bound fields rather than
 * the staged keys: a field added as required after the entry was written appears
 * in no existing draft, and iterating `staged` would never reach it. A field the
 * draft does stage needs no link read.
 */
export async function validateStagedReferences(
	db: Kysely<Database>,
	collection: string,
	staged: StagedReferences,
	entryGroup: string,
	baselines?: StagedReferenceBaselines,
): Promise<ApiResult<true>> {
	const repo = new RelationRepository(db);
	for (const field of (await referenceFieldConstraints(db, collection)).values()) {
		const isStaged = Object.hasOwn(staged, field.slug);
		let groups = isStaged ? (staged[field.slug] ?? []) : undefined;
		const baseline = baselines?.[field.slug];
		if (groups && baseline) {
			const live = await liveFieldSelection(repo, field, entryGroup);
			groups = applyReferenceDiff(baseline, groups, live);
		}
		groups ??= await liveFieldSelection(repo, field, entryGroup);
		const valid = validateReferenceSelection(field, groups);
		if (!valid.success) return valid;

		// Only a staged selection can have gone stale: a live one is already
		// within the limits it was written under.
		if (!isStaged || field.relationId === null) continue;
		const far = await validateOppositeSideLimit(db, {
			relationId: field.relationId,
			farLimit: field.maxOpposite,
			side: field.relationSide,
			entryGroup,
			groups,
		});
		if (!far.success) return far;
	}
	return { success: true, data: true };
}

/**
 * The live selection, in the same shape a draft stages: every bound reference
 * field on the collection, by field slug, as translation groups.
 *
 * One link read per bound field. Used where both selections have to be
 * comparable — the live and draft sides of a compare — never on a render path.
 */
export async function liveReferenceSelection(
	db: Kysely<Database>,
	collection: string,
	entryGroup: string,
): Promise<StagedReferences> {
	const repo = new RelationRepository(db);
	const selection: StagedReferences = {};
	for (const field of (await referenceFieldConstraints(db, collection)).values()) {
		selection[field.slug] = await liveFieldSelection(repo, field, entryGroup);
	}
	return selection;
}

/**
 * Compute the selection that results from applying the staged-versus-baseline
 * diff on top of the current live selection.
 *
 * Additions and removals made in the draft win. Items the draft left unchanged
 * follow the current live selection, preserving additions and removals made
 * from the relation's opposite end.
 */
function applyReferenceDiff(baseline: string[], staged: string[], live: string[]): string[] {
	const baselineSet = new Set(baseline);
	const stagedSet = new Set(staged);
	const liveSet = new Set(live);
	const additionSet = new Set(staged.filter((group) => !baselineSet.has(group)));
	const removalSet = new Set(baseline.filter((group) => !stagedSet.has(group)));

	const result: string[] = [];
	const seen = new Set<string>();
	for (const group of staged) {
		if ((!additionSet.has(group) && !liveSet.has(group)) || seen.has(group)) continue;
		result.push(group);
		seen.add(group);
	}
	for (const group of live) {
		if (removalSet.has(group) || seen.has(group)) continue;
		result.push(group);
		seen.add(group);
	}
	return result;
}

/**
 * Record the complete live selection in the revision publication just made live.
 *
 * A draft stages only the fields its saves named, and a revision written from
 * the columns stages none. Restoring either would otherwise leave whatever was
 * published after it linked in the fields it does not carry.
 */
export async function recordPublishedReferences(
	db: Kysely<Database>,
	collection: string,
	revisionId: string,
	entryGroup: string,
): Promise<void> {
	const selection = await liveReferenceSelection(db, collection, entryGroup);
	if (Object.keys(selection).length === 0) return;
	await new RevisionRepository(db).mergeData(revisionId, { [STAGED_REFERENCES_KEY]: selection });
}

/**
 * Promote a staged selection to live links.
 *
 * A field slug the collection no longer carries as a bound reference field is
 * skipped: the revision outlived the field, and there is no relation left to
 * write into.
 *
 * When `baselines` are provided, each staged field is promoted as a diff
 * against its baseline rather than as a wholesale replacement. That prevents a
 * draft saved before a concurrent opposite-end publish from undoing the links
 * that publish added or removed.
 */
export async function applyStagedReferences(
	db: Kysely<Database>,
	collection: string,
	entryGroup: string,
	staged: StagedReferences,
	baselines?: StagedReferenceBaselines,
): Promise<void> {
	const constraints = await referenceFieldConstraints(db, collection);
	const repo = new RelationRepository(db);
	for (const [fieldSlug, groups] of Object.entries(staged)) {
		const field = constraints.get(fieldSlug);
		if (!field) continue;

		const baseline = baselines?.[fieldSlug];
		let selection: string[];
		if (baseline) {
			const live = await liveFieldSelection(repo, field, entryGroup);
			selection = applyReferenceDiff(baseline, groups, live);
		} else {
			// Older drafts and restored live revisions carry no baseline; keep the
			// previous wholesale-replacement behavior rather than silently changing
			// their semantics.
			selection = groups;
		}

		await writeReferenceSelection(db, {
			relation: field.relation,
			side: field.relationSide,
			entryGroup,
			groups: selection,
		});
	}
}

// Explicit Native read-only export seam; the complete original algorithm above is unchanged.
export const referenceSelectionDiff = applyReferenceDiff;
