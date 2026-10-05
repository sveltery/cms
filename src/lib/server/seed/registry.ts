// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// Complete Source read/projection and block validation members; sole Native writer composition.
import {sql,type Kysely,type Selectable} from 'kysely';
import {SchemaRegistry as NativeSchemaRegistry} from '../database/registry.ts';
import {seedDatabaseOwner} from './namespace.ts';
import {SchemaError} from '../blocks/upstream/schema/registry.ts';
import type {Database,CollectionTable,FieldTable} from './upstream/database/types.ts';
import {FIELD_TYPE_TO_COLUMN,REPEATER_SUB_FIELD_TYPES,type Collection,type CollectionWithFields,type Field,type CollectionSource,type FieldType,type ColumnType,type UnsupportedFieldType,type CollectionSupport,type CollectionAdminConfig,type CreateCollectionInput,type CreateFieldInput,type FieldValidation,type UpdateCollectionInput,type UpdateFieldInput} from '../schema/types.ts';
import {validateIdentifier} from '../database/lifecycle/upstream/database/validate.ts';
import {MAX_BLOCKS_ITEMS} from '../schema/types.ts';
export {SchemaError};
const COLUMN_TYPES: ReadonlySet<string> = new Set(["TEXT", "REAL", "INTEGER", "JSON"]);

const VALID_SOURCES: ReadonlySet<string> = new Set(["manual", "discovered", "seed"]);

function isCollectionSource(value: string): value is CollectionSource {
	return VALID_SOURCES.has(value) || value.startsWith("template:") || value.startsWith("import:");
}

function isFieldType(value: string): value is FieldType {
	return value in FIELD_TYPE_TO_COLUMN;
}

function isColumnType(value: string): value is ColumnType {
	return COLUMN_TYPES.has(value);
}

const REPEATER_SUB_FIELD_TYPE_SET: ReadonlySet<string> = new Set(REPEATER_SUB_FIELD_TYPES);

function findUnsupportedRepeaterSubFieldType(
	validation: unknown,
): UnsupportedFieldType | undefined {
	if (!validation || typeof validation !== "object") return undefined;
	const subFields = "subFields" in validation ? validation.subFields : undefined;
	if (!Array.isArray(subFields)) return undefined;

	for (const [index, subField] of subFields.entries()) {
		if (!subField || typeof subField !== "object") continue;
		const type = "type" in subField ? subField.type : undefined;
		if (typeof type === "string" && !REPEATER_SUB_FIELD_TYPE_SET.has(type)) {
			return { type, path: `validation.subFields[${index}].type` };
		}
	}

	return undefined;
}

const VALID_COLLECTION_SUPPORTS: ReadonlySet<string> = new Set<CollectionSupport>([
	"drafts",
	"revisions",
	"preview",
	"scheduling",
	"search",
	"seo",
]);

const UNORDERED_COLLECTION_RANK = 2147483647;

const collectionOrder = sql<number>`coalesce(sort_order, ${sql.lit(UNORDERED_COLLECTION_RANK)})`;

function isCollectionSupport(value: unknown): value is CollectionSupport {
	return typeof value === "string" && VALID_COLLECTION_SUPPORTS.has(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseSupports(raw: string | null | undefined): CollectionSupport[] {
	if (!raw) return [];
	const parsed: unknown = JSON.parse(raw);
	if (!Array.isArray(parsed)) return [];
	return parsed.filter(isCollectionSupport);
}

function parseCollectionAdmin(raw: string | null | undefined): CollectionAdminConfig | undefined {
	if (!raw) return undefined;
	const parsed: unknown = JSON.parse(raw);
	if (!isRecord(parsed)) return undefined;
	const listColumns = parsed.listColumns;
	return {
		listColumns: Array.isArray(listColumns)
			? listColumns.filter((value): value is string => typeof value === "string")
			: undefined,
		quickCreate: typeof parsed.quickCreate === "boolean" ? parsed.quickCreate : undefined,
	};
}

export class SchemaRegistry {
  private readonly db:Kysely<Database>;
  private readonly writer:NativeSchemaRegistry;
  constructor(db:Kysely<Database>){this.db=db;this.writer=new NativeSchemaRegistry(seedDatabaseOwner(db));}
async listCollections(): Promise<Collection[]> {
		const rows = await this.db
			.selectFrom("_emdash_collections")
			.selectAll()
			.orderBy(collectionOrder, "asc")
			.orderBy("slug", "asc")
			.execute();

		return rows.map(this.mapCollectionRow);
	}

async getCollection(slug: string): Promise<Collection | null> {
		const row = await this.db
			.selectFrom("_emdash_collections")
			.where("slug", "=", slug)
			.selectAll()
			.executeTakeFirst();

		return row ? this.mapCollectionRow(row) : null;
	}

async getCollectionWithFields(slug: string): Promise<CollectionWithFields | null> {
		const collection = await this.getCollection(slug);
		if (!collection) return null;

		const fields = await this.listFields(collection.id);

		return { ...collection, fields };
	}

async listFields(collectionId: string): Promise<Field[]> {
		const rows = await this.db
			.selectFrom("_emdash_fields")
			.where("collection_id", "=", collectionId)
			.selectAll()
			.orderBy("sort_order", "asc")
			.orderBy("created_at", "asc")
			.execute();

		return rows.map(this.mapFieldRow);
	}

async getField(collectionSlug: string, fieldSlug: string): Promise<Field | null> {
		const collection = await this.getCollection(collectionSlug);
		if (!collection) return null;

		const row = await this.db
			.selectFrom("_emdash_fields")
			.where("collection_id", "=", collection.id)
			.where("slug", "=", fieldSlug)
			.selectAll()
			.executeTakeFirst();

		return row ? this.mapFieldRow(row) : null;
	}

private mapCollectionRow = (row: Selectable<CollectionTable>): Collection => {
		const moderation = row.comments_moderation;
		return {
			id: row.id,
			slug: row.slug,
			label: row.label,
			labelSingular: row.label_singular ?? undefined,
			description: row.description ?? undefined,
			icon: row.icon ?? undefined,
			admin: parseCollectionAdmin(row.admin_config),
			supports: parseSupports(row.supports),
			source: row.source && isCollectionSource(row.source) ? row.source : undefined,
			hasSeo: row.has_seo === 1,
			// Raw value; undefined when unset. The admin list resolves the
			// default (title fallback chain / updatedAt) at the point of use.
			titleField: row.title_field ?? undefined,
			dateField: row.date_field ?? undefined,
			urlPattern: row.url_pattern ?? undefined,
			routable: row.routable !== 0,
			hidden: row.hidden === 1,
			sortOrder: row.sort_order ?? undefined,
			group: row.nav_group ?? undefined,
			commentsEnabled: row.comments_enabled === 1,
			commentsModeration:
				moderation === "all" || moderation === "first_time" || moderation === "none"
					? moderation
					: "first_time",
			commentsClosedAfterDays: row.comments_closed_after_days ?? 90,
			commentsAutoApproveUsers: row.comments_auto_approve_users === 1,
			editLocking: row.edit_locking !== 0,
			createdAt: row.created_at,
			updatedAt: row.updated_at,
		};
	};

private mapFieldRow = (row: Selectable<FieldTable>): Field => {
		const validation = row.validation ? JSON.parse(row.validation) : undefined;
		const unsupportedType = isFieldType(row.type)
			? row.type === "repeater"
				? findUnsupportedRepeaterSubFieldType(validation)
				: undefined
			: { type: row.type, path: "type" };
		return {
			id: row.id,
			collectionId: row.collection_id,
			slug: row.slug,
			label: row.label,
			type: isFieldType(row.type) ? row.type : "string",
			unsupportedType,
			columnType: isColumnType(row.column_type) ? row.column_type : "TEXT",
			required: row.required === 1,
			unique: row.unique === 1,
			defaultValue: row.default_value ? JSON.parse(row.default_value) : undefined,
			validation,
			widget: row.widget ?? undefined,
			options: row.options ? JSON.parse(row.options) : undefined,
			sortOrder: row.sort_order,
			searchable: row.searchable === 1,
			indexed: row.indexed === 1,
			translatable: row.translatable !== 0,
			createdAt: row.created_at,
		};
	};

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
				.selectFrom("_emdash_block_types")
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
					.selectFrom("_emdash_block_type_versions")
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

private async collectionHasContent(
		slug: string,
		db: Kysely<Database> = this.db,
	): Promise<boolean> {
		const tableName = this.getTableName(slug);
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
	private getTableName(slug: string): string {
		validateIdentifier(slug, "collection slug");
		return `ec_${slug}`;
	}

  async createCollection(input:CreateCollectionInput):Promise<Collection> {
    await this.writer.createCollection(input);
    return (await this.getCollection(input.slug))!;
  }
  async createSeedCollection(input:Omit<CreateCollectionInput,'source'>,fields:readonly CreateFieldInput[]):Promise<void> {
    const normalized:CreateFieldInput[]=[];
    for(const field of fields) normalized.push(field.type==='blocks'?{...field,validation:await this.normalizeBlocksFieldValidation(input.slug,field,undefined,this.db,false)}:{...field});
    await this.writer.createSeedCollectionSchema(input,normalized);
  }
  async createField(collectionSlug:string,input:CreateFieldInput):Promise<Field> {
    const normalized=input.type==='blocks'?{...input,validation:await this.normalizeBlocksFieldValidation(collectionSlug,input,undefined,this.db)}:input;
    await this.writer.createField(collectionSlug,normalized);
    return (await this.getField(collectionSlug,input.slug))!;
  }
  async updateCollection(slug:string,input:UpdateCollectionInput):Promise<Collection> {
    await this.writer.updateCollection(slug,input);
    return (await this.getCollection(slug))!;
  }
  async updateField(collectionSlug:string,fieldSlug:string,input:UpdateFieldInput):Promise<Field> {
    await this.writer.updateField(collectionSlug,fieldSlug,input);
    return (await this.getField(collectionSlug,fieldSlug))!;
  }
  async registerOrphanedTable(slug:string,options?:{label?:string;labelSingular?:string;description?:string}):Promise<Collection> {
    await this.writer.registerOrphanedTable(slug,options);
    return (await this.getCollection(slug))!;
  }
}
