// Complete function bodies from EmDash1.1.0 immutable913cb1bb9b7f08c3ff0d258b4420e53835b6a58e.
// Copyright2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
// Native imports and trusted canonical namespace hosting; bodies remain exact.
import type {Kysely} from 'kysely';
import type {Database as NativeDatabase} from '../database/lifecycle/upstream/database/types.ts';
import type {ContentItem} from '../database/lifecycle/upstream/database/repositories/types.ts';
import {ContentRepository as NativeContentRepository} from '../database/lifecycle/upstream/database/repositories/content.ts';
import {RevisionRepository as NativeRevisionRepository} from '../database/lifecycle/upstream/database/repositories/revision.ts';
import {RelationRepository as NativeRelationRepository} from './repository.ts';
import {getReferenceTitleField as nativeGetReferenceTitleField,resolveEntries,resolveEntryGroups} from './handlers.ts';
import {liveReferenceSelection as nativeLiveReferenceSelection} from './staged-content.ts';
import {pageStagedGroups,readStagedReferences,STAGED_REFERENCES_KEY,type StagedReferences} from './staged.ts';
import type {ApiResult} from '../menus/api-types.ts';
import type {CmsDatabase} from '../database/contract.ts';
import {canonicalSourceDatabase} from '../canonical-storage/namespace.ts';

// Logical aliases are only trusted identifiers on the existing canonical DB.
type Database=NativeDatabase&{_emdash_collections:NativeDatabase['_cms_collections'];_emdash_fields:NativeDatabase['_cms_fields']};

// These constructor/type adapters preserve the actual repository implementations.
// Only the trusted logical Kysely type widens to the pinned alias identifiers.
const nativeReadDatabase=(db:Kysely<Database>)=>db as unknown as Kysely<NativeDatabase>;
class ContentRepository extends NativeContentRepository {constructor(db:Kysely<Database>){super(nativeReadDatabase(db));}}
class RevisionRepository extends NativeRevisionRepository {constructor(db:Kysely<Database>){super(nativeReadDatabase(db));}}
class RelationRepository extends NativeRelationRepository {constructor(db:Kysely<Database>){super(nativeReadDatabase(db));}}
const getReferenceTitleField=(db:Kysely<Database>,collection:string)=>nativeGetReferenceTitleField(nativeReadDatabase(db),collection);
const liveReferenceSelection=(db:Kysely<Database>,collection:string,group:string)=>nativeLiveReferenceSelection(nativeReadDatabase(db),collection,group);

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

async function hydrateReferences(
	db: Kysely<Database>,
	collection: string,
	item: ContentItem,
	includeDrafts: boolean,
): Promise<void> {
	if (!item.translationGroup) return;

	const collectionRow = await db
		.selectFrom("_emdash_collections")
		.select("id")
		.where("slug", "=", collection)
		.executeTakeFirst();
	if (!collectionRow) return;

	const fields = await db
		.selectFrom("_emdash_fields")
		.select(["slug", "validation"])
		.where("collection_id", "=", collectionRow.id)
		.where("type", "=", "reference")
		.execute();

	const references: NonNullable<ContentItem["references"]> = {};
	if (fields.length === 0) {
		item.references = references;
		return;
	}

	const repo = new RelationRepository(db);
	const content = new ContentRepository(db);

	const staged =
		includeDrafts && item.draftRevisionId
			? readStagedReferences(
					(await new RevisionRepository(db).findById(item.draftRevisionId))?.data,
				)
			: undefined;

	for (const field of fields) {
		let validation: Record<string, unknown> = {};
		if (field.validation) {
			let parsed: unknown;
			try {
				parsed = JSON.parse(field.validation);
			} catch {
				continue;
			}
			if (isRecord(parsed)) validation = parsed;
		}
		const relation = typeof validation.relation === "string" ? validation.relation : undefined;
		const targetCollection =
			typeof validation.targetCollection === "string" ? validation.targetCollection : undefined;
		// A field with no relation keeps its own column; its value is already in
		// `data` and there are no links to resolve.
		if (!relation || !targetCollection) continue;

		const stagedGroups = staged?.[field.slug];
		if (stagedGroups) {
			// Paged like the links below it: the REST contract promises one page and
			// a cursor whichever selection answers, and the editor walks the rest
			// through the same edge route either way.
			const page = pageStagedGroups(stagedGroups);
			references[field.slug] = {
				children: await resolveEntryGroups(
					content,
					targetCollection,
					page.groups,
					item.locale,
					includeDrafts,
					await getReferenceTitleField(db, targetCollection),
				),
				...(page.nextCursor ? { nextCursor: page.nextCursor } : {}),
			};
			continue;
		}

		// A field on the child end of its relation selects parents, which carry no
		// order of their own — `sort_order` positions children within one parent.
		const onChildSide = validation.relationSide === "child";
		const edges = onChildSide
			? await repo.getParentsPage(relation, item.translationGroup)
			: await repo.getChildrenPage(relation, item.translationGroup);
		const children = await resolveEntries(
			content,
			targetCollection,
			edges.items,
			(e) => (onChildSide ? e.parentGroup : e.childGroup),
			item.locale,
			includeDrafts,
			await getReferenceTitleField(db, targetCollection),
		);
		references[field.slug] = {
			children,
			...(edges.nextCursor ? { nextCursor: edges.nextCursor } : {}),
		};
	}

	item.references = references;
}

export async function handleContentCompare(
	db: Kysely<Database>,
	collection: string,
	id: string,
): Promise<
	ApiResult<{
		hasChanges: boolean;
		live: Record<string, unknown> | null;
		draft: Record<string, unknown> | null;
	}>
> {
	try {
		const repo = new ContentRepository(db);
		const entry = await repo.findByIdOrSlug(collection, id);

		if (!entry) {
			return {
				success: false,
				error: {
					code: "NOT_FOUND",
					message: `Content item not found: ${id}`,
				},
			};
		}

		const revisionRepo = new RevisionRepository(db);

		const live = entry.liveRevisionId ? await revisionRepo.findById(entry.liveRevisionId) : null;
		const draft = entry.draftRevisionId ? await revisionRepo.findById(entry.draftRevisionId) : null;

		// Reference selections have to be filled in from the links on both sides
		// before they can be compared. The published selection is the links, not
		// whatever `_references` the live revision happens to carry; and the draft
		// stages only the fields its saves named, so the rest of its effective
		// selection is the live one.
		const liveReferences = entry.translationGroup
			? await liveReferenceSelection(db, collection, entry.translationGroup)
			: {};
		const withReferences = (
			revisionData: Record<string, unknown> | undefined,
			staged: StagedReferences,
		) => {
			if (!revisionData) return undefined;
			const selection = { ...liveReferences, ...staged };
			if (Object.keys(selection).length === 0) return revisionData;
			return { ...revisionData, [STAGED_REFERENCES_KEY]: selection };
		};

		return {
			success: true,
			data: {
				hasChanges:
					entry.draftRevisionId !== null && entry.draftRevisionId !== entry.liveRevisionId,
				live: withReferences(live?.data, {}) ?? null,
				draft: withReferences(draft?.data, readStagedReferences(draft?.data) ?? {}) ?? null,
			},
		};
	} catch (error) {
		console.error("Content compare error:", error);
		return {
			success: false,
			error: {
				code: "CONTENT_COMPARE_ERROR",
				message: "Failed to compare revisions",
			},
		};
	}
}

/** Read-only hosting adapters. No writer, store or caller-supplied namespace. */
export async function hydrateContentReferences(database:CmsDatabase,item:ContentItem,includeDrafts:boolean):Promise<ContentItem>{
 await hydrateReferences(canonicalSourceDatabase(database) as unknown as Kysely<Database>,item.type,item,includeDrafts);
 return item;
}
export function compareContentReferences(database:CmsDatabase,collection:string,id:string){
 return handleContentCompare(canonicalSourceDatabase(database) as unknown as Kysely<Database>,collection,id);
}
