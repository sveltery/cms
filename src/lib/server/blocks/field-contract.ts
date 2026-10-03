// Complete collectionHasContent and normalizeBlocksFieldValidation methods from immutable EmDash 1.1.0 registry.ts.
// Pin 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
import {sql,type Kysely} from "kysely";
import type {Database} from "../media/source/database/types.ts";
import type {CreateFieldInput,Field,FieldValidation} from "../schema/types.ts";
import {SchemaError} from "./errors.ts";
const MAX_BLOCKS_ITEMS=100;
class BlocksFieldContract {
 private db:Kysely<Database>;
 constructor(db:Kysely<Database>){this.db=db;}
	private async collectionHasContent(
		slug: string,
		db: Kysely<Database> = this.db,
	): Promise<boolean> {
		const tableName = `ec_${slug}`;
		try {
			const result = await sql<{ count: number }>`
				SELECT COUNT(*) as count FROM ${sql.ref(tableName)}
				WHERE deleted_at IS NULL
			`.execute(db);
			return (result.rows[0]?.count ?? 0) > 0;
		} catch {
			// Table might not exist
			return false;
		}
	}

	private async normalizeBlocksFieldValidation(
		collectionSlug: string,
		input: CreateFieldInput,
		existing: Field | undefined,
		db: Kysely<Database>,
		checkContent = true,
	): Promise<FieldValidation> {
		if (input.required) {
			throw new SchemaError("Blocks fields cannot be required", "VALIDATION_ERROR", {
				path: "required",
			});
		}
		if (input.unique) {
			throw new SchemaError("Blocks fields cannot be unique", "VALIDATION_ERROR", {
				path: "unique",
			});
		}
		if (input.indexed) {
			throw new SchemaError("Blocks fields cannot be indexed", "FIELD_NOT_INDEXABLE", {
				path: "indexed",
			});
		}
		if (input.searchable) {
			throw new SchemaError("Blocks fields cannot be searchable", "VALIDATION_ERROR", {
				path: "searchable",
			});
		}
		if (input.widget !== undefined) {
			throw new SchemaError("Blocks fields cannot use custom widgets", "VALIDATION_ERROR", {
				path: "widget",
			});
		}
		if (input.options !== undefined) {
			throw new SchemaError("Blocks fields do not accept widget options", "VALIDATION_ERROR", {
				path: "options",
			});
		}
		if (
			input.defaultValue !== undefined &&
			(!Array.isArray(input.defaultValue) || input.defaultValue.length > 0)
		) {
			throw new SchemaError("Blocks field defaults must be an empty array", "VALIDATION_ERROR", {
				path: "defaultValue",
			});
		}

		const requested = input.validation ?? existing?.validation ?? {};
		const allowedTypes = requested.allowedTypes ?? [];
		if (!Array.isArray(allowedTypes) || allowedTypes.some((slug) => typeof slug !== "string")) {
			throw new SchemaError(
				"allowedTypes must be an array of block type slugs",
				"VALIDATION_ERROR",
				{
					path: "validation.allowedTypes",
				},
			);
		}
		if (new Set(allowedTypes).size !== allowedTypes.length) {
			throw new SchemaError("allowedTypes must not contain duplicates", "VALIDATION_ERROR", {
				path: "validation.allowedTypes",
			});
		}

		const previousAllowed = existing?.validation?.allowedTypes ?? [];
		const previousRetired = existing?.validation?.retiredTypes ?? [];
		const requestedRetired = existing ? previousRetired : (requested.retiredTypes ?? []);
		if (
			!Array.isArray(requestedRetired) ||
			requestedRetired.some((slug) => typeof slug !== "string")
		) {
			throw new SchemaError(
				"retiredTypes must be an array of block type slugs",
				"VALIDATION_ERROR",
				{
					path: "validation.retiredTypes",
				},
			);
		}
		const retiredTypes = [
			...new Set([
				...requestedRetired,
				...previousAllowed.filter((slug) => !allowedTypes.includes(slug)),
			]),
		].filter((slug) => !allowedTypes.includes(slug));

		const minItems = requested.minItems ?? 0;
		const maxItems = requested.maxItems ?? MAX_BLOCKS_ITEMS;
		if (!Number.isInteger(minItems) || minItems < 0) {
			throw new SchemaError("minItems must be a non-negative integer", "VALIDATION_ERROR", {
				path: "validation.minItems",
			});
		}
		if (!Number.isInteger(maxItems) || maxItems < 1 || maxItems > MAX_BLOCKS_ITEMS) {
			throw new SchemaError(
				`maxItems must be an integer between 1 and ${MAX_BLOCKS_ITEMS}`,
				"VALIDATION_ERROR",
				{ path: "validation.maxItems" },
			);
		}
		if (minItems > maxItems) {
			throw new SchemaError("minItems cannot exceed maxItems", "VALIDATION_ERROR", {
				path: "validation.minItems",
			});
		}
		const previousMin = existing?.validation?.minItems ?? 0;
		if (
			checkContent &&
			minItems > previousMin &&
			minItems > 0 &&
			(await this.collectionHasContent(collectionSlug, db))
		) {
			throw new SchemaError(
				"Raising minItems on a populated collection requires a content migration",
				"FIELD_UPDATE_REQUIRES_MIGRATION",
				{ path: "validation.minItems" },
			);
		}

		const referenced = [...new Set([...allowedTypes, ...retiredTypes])];
		if (referenced.length > 0) {
			const types = await db
				.selectFrom("_cms_block_types")
				.select(["id", "slug", "current_version"])
				.where("slug", "in", referenced)
				.execute();
			const bySlug = new Map(types.map((type) => [type.slug, type]));
			for (const slug of referenced) {
				if (!bySlug.has(slug)) {
					throw new SchemaError(`Block type "${slug}" not found`, "BLOCK_TYPE_NOT_FOUND", {
						slug,
					});
				}
			}
			const allowedRows = allowedTypes.map((slug) => bySlug.get(slug)!);
			if (allowedRows.length > 0) {
				const activeVersions = await db
					.selectFrom("_cms_block_type_versions")
					.select(["block_type_id", "version"])
					.where(
						"block_type_id",
						"in",
						allowedRows.map((type) => type.id),
					)
					.execute();
				for (const type of allowedRows) {
					if (
						!activeVersions.some(
							(version) =>
								version.block_type_id === type.id && version.version === type.current_version,
						)
					) {
						throw new SchemaError(
							`Block type "${type.slug}" has no active version ${type.current_version}`,
							"BLOCK_TYPE_VERSION_CONFLICT",
							{ slug: type.slug, version: type.current_version },
						);
					}
				}
			}
		}

		return { allowedTypes, retiredTypes, minItems, maxItems };
	}

 public normalize(collection:string,input:CreateFieldInput,existing?:Field){return this.normalizeBlocksFieldValidation(collection,input,existing,this.db);}
}
export const normalizeBlocksFieldValidation=(db:Kysely<Database>,collection:string,input:CreateFieldInput,existing?:Field)=>new BlocksFieldContract(db).normalize(collection,input,existing);
