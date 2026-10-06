// Complete immutable Source content.ts storage-less validation function bodies.
// Native imports/type hosting only; Copyright2026 Cloudflare Inc. MIT.
// 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; notices/emdash-MIT.txt.
import type {Kysely} from 'kysely';
import type {Database} from '../canonical-storage/types.ts';
import {isStoragelessFieldRow} from '../schema/types.ts';
export async function storagelessDataKeys(
	db: Kysely<Database>,
	collection: string,
	data: Record<string, unknown>,
): Promise<string[]> {
	const collectionRow = await db
		.selectFrom("_emdash_collections")
		.select("id")
		.where("slug", "=", collection)
		.executeTakeFirst();
	if (!collectionRow) return [];
	const fields = await db
		.selectFrom("_emdash_fields")
		.select(["slug", "type", "validation"])
		.where("collection_id", "=", collectionRow.id)
		.execute();
	const storageless = new Set(fields.filter(isStoragelessFieldRow).map((f) => f.slug));
	if (storageless.size === 0) return [];
	return Object.keys(data).filter((key) => storageless.has(key));
}

export function storagelessDataKeyError(keys: string[]): {
	success: false;
	error: { code: string; message: string };
} {
	return {
		success: false,
		error: {
			code: "VALIDATION_ERROR",
			message: `Reference fields bound to a relation are set through 'references', not 'data': ${keys.join(", ")}`,
		},
	};
}

export function changedStoragelessDataKeys(
	storageless: ReadonlySet<string>,
	data: Record<string, unknown>,
	stored: Record<string, unknown>,
): string[] {
	return Object.keys(data).filter(
		(key) =>
			storageless.has(key) &&
			(!Object.hasOwn(stored, key) || JSON.stringify(data[key]) !== JSON.stringify(stored[key])),
	);
}
