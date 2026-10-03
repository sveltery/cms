// @ts-nocheck -- complete immutable source DDL fragments, not source test credit.
// Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
// Pin913cb1bb9b7f08c3ff0d258b4420e53835b6a58e: packages/core/src/schema/registry.ts.
// Native fixture wrapper binds real registered metadata/SQLite; no full public Registry/media activation credit.
import {sql} from "kysely";
import {currentTimestamp} from "../../src/lib/server/taxonomies/upstream/database/dialect-helpers.ts";
import {validateIdentifier} from "../../src/lib/server/taxonomies/upstream/database/validate.ts";
import {FIELD_TYPE_TO_COLUMN,isStoragelessField} from "../../src/lib/server/taxonomies/upstream/schema/types.ts";
const SINGLE_QUOTE_PATTERN = /'/g;
const COLUMN_TYPE_TO_DATA_TYPE = {
	TEXT: "text",
	REAL: "real",
	INTEGER: "integer",
	JSON: "json",
} satisfies Record<ColumnType, ColumnDataType>;
class PinnedContentDDL {
private async createContentTable(
		slug: string,
		db?: Kysely<Database>,
		fields: readonly CreateFieldInput[] = [],
		options: { ifNotExists?: boolean } = {},
	): Promise<void> {
		const conn = db ?? this.db;
		const tableName = this.getTableName(slug);

		let table: CreateTableBuilder<string, string> = conn.schema
			.createTable(tableName)
			.addColumn("id", "text", (col) => col.primaryKey())
			.addColumn("slug", "text")
			.addColumn("status", "text", (col) => col.defaultTo("draft"))
			.addColumn("author_id", "text")
			.addColumn("primary_byline_id", "text")
			.addColumn("created_at", "text", (col) => col.defaultTo(currentTimestamp(conn)))
			.addColumn("updated_at", "text", (col) => col.defaultTo(currentTimestamp(conn)))
			.addColumn("published_at", "text")
			.addColumn("scheduled_at", "text")
			.addColumn("deleted_at", "text")
			.addColumn("version", "integer", (col) => col.defaultTo(1))
			.addColumn("live_revision_id", "text", (col) => col.references("revisions.id"))
			.addColumn("draft_revision_id", "text", (col) => col.references("revisions.id"))
			.addColumn("locale", "text", (col) => col.notNull().defaultTo("en"))
			.addColumn("translation_group", "text");
		if (options.ifNotExists) table = table.ifNotExists();

		for (const field of fields) {
			if (isStoragelessField(field)) continue;

			const columnName = this.getColumnName(field.slug);
			const columnType = COLUMN_TYPE_TO_DATA_TYPE[FIELD_TYPE_TO_COLUMN[field.type]];
			table = table.addColumn(columnName, columnType, (column) => {
				if (field.type === "blocks") return column.notNull().defaultTo("[]");
				if (!field.required) return column;

				const defaultValue =
					field.defaultValue !== undefined
						? this.formatDefaultValue(field.defaultValue, field.type)
						: this.getEmptyDefault(field.type);
				return column.notNull().defaultTo(sql.raw(defaultValue));
			});
		}

		await table
			.addUniqueConstraint(`${tableName}_slug_locale_unique`, ["slug", "locale"])
			.execute();

		const createIndex = options.ifNotExists ? sql`CREATE INDEX IF NOT EXISTS` : sql`CREATE INDEX`;
		const createUniqueIndex = options.ifNotExists
			? sql`CREATE UNIQUE INDEX IF NOT EXISTS`
			: sql`CREATE UNIQUE INDEX`;

		// Create standard indexes
		await sql`
			${createIndex} ${sql.ref(`idx_${tableName}_slug`)}
			ON ${sql.ref(tableName)} (slug)
		`.execute(conn);

		// Name must stay identical to migration 074. `deleted_at` leads so the
		// scheduled-publishing sweep can seek it and walk `scheduled_at` for both
		// its range and its ORDER BY; a `scheduled_at`-only index leaves a
		// stats-blind planner reading every live row.
		await sql`
			${createIndex} ${sql.ref(`idx_${tableName}_del_sched`)}
			ON ${sql.ref(tableName)} (deleted_at, scheduled_at)
			WHERE scheduled_at IS NOT NULL
		`.execute(conn);

		await sql`
			${createIndex} ${sql.ref(`idx_${tableName}_live_revision`)}
			ON ${sql.ref(tableName)} (live_revision_id)
		`.execute(conn);

		await sql`
			${createIndex} ${sql.ref(`idx_${tableName}_draft_revision`)}
			ON ${sql.ref(tableName)} (draft_revision_id)
		`.execute(conn);

		await sql`
			${createIndex} ${sql.ref(`idx_${tableName}_author`)}
			ON ${sql.ref(tableName)} (author_id)
		`.execute(conn);

		await sql`
			${createIndex} ${sql.ref(`idx_${tableName}_primary_byline`)}
			ON ${sql.ref(tableName)} (primary_byline_id)
		`.execute(conn);

		await sql`
			${createIndex} ${sql.ref(`idx_${tableName}_locale`)}
			ON ${sql.ref(tableName)} (locale)
		`.execute(conn);

		// Names must stay identical to migration 055, which creates these indexes
		// on tables that already exist. Lookups that don't constrain `deleted_at`
		// (menu and reference resolution) need the first; reads that do need the
		// second.
		await sql`
			${createIndex} ${sql.ref(`idx_${tableName}_tg_locale`)}
			ON ${sql.ref(tableName)} (translation_group, locale)
		`.execute(conn);

		await sql`
			${createIndex} ${sql.ref(`idx_${tableName}_del_tg_locale`)}
			ON ${sql.ref(tableName)} (deleted_at, translation_group, locale)
		`.execute(conn);

		await sql`
			${createUniqueIndex} ${sql.ref(`uidx_${tableName}_active_tg_locale`)}
			ON ${sql.ref(tableName)} (translation_group, lower(locale))
			WHERE deleted_at IS NULL AND translation_group IS NOT NULL
		`.execute(conn);

		// Composite indexes for optimized query performance (see migration 033)
		await sql`
			${createIndex} ${sql.ref(`idx_${tableName}_deleted_updated_id`)}
			ON ${sql.ref(tableName)} (deleted_at, updated_at DESC, id DESC)
		`.execute(conn);

		await sql`
			${createIndex} ${sql.ref(`idx_${tableName}_deleted_status`)}
			ON ${sql.ref(tableName)} (deleted_at, status)
		`.execute(conn);

		await sql`
			${createIndex} ${sql.ref(`idx_${tableName}_deleted_created_id`)}
			ON ${sql.ref(tableName)} (deleted_at, created_at DESC, id DESC)
		`.execute(conn);

		await sql`
			${createIndex} ${sql.ref(`idx_${tableName}_deleted_published_id`)}
			ON ${sql.ref(tableName)} (deleted_at, published_at DESC, id DESC)
		`.execute(conn);

		// Locale-aware composite indexes for i18n content lists (see migration 041).
		// Short `loc_upd`/`loc_crt` suffix keeps the updated/created discriminator
		// inside Postgres's 63-byte identifier limit for long slugs; keep these
		// names identical to migration 041.
		await sql`
			${createIndex} ${sql.ref(`idx_${tableName}_loc_upd`)}
			ON ${sql.ref(tableName)} (deleted_at, locale, updated_at DESC, id DESC)
		`.execute(conn);

		await sql`
			${createIndex} ${sql.ref(`idx_${tableName}_loc_crt`)}
			ON ${sql.ref(tableName)} (deleted_at, locale, created_at DESC, id DESC)
		`.execute(conn);
	}
private getTableName(slug: string): string {
		validateIdentifier(slug, "collection slug");
		return `ec_${slug}`;
	}
private getColumnName(slug: string): string {
		validateIdentifier(slug, "field slug");
		return slug;
	}
private formatDefaultValue(value: unknown, fieldType: FieldType): string {
		if (value === null || value === undefined) {
			return "NULL";
		}

		const columnType = FIELD_TYPE_TO_COLUMN[fieldType];

		if (columnType === "JSON") {
			// JSON.stringify produces valid JSON; escape single quotes for SQL literal
			const json = JSON.stringify(value);
			return `'${json.replace(SINGLE_QUOTE_PATTERN, "''")}'`;
		}

		if (columnType === "INTEGER") {
			if (typeof value === "boolean") {
				return value ? "1" : "0";
			}
			const num = Number(value);
			if (!Number.isFinite(num)) {
				return "0";
			}
			return String(Math.trunc(num));
		}

		if (columnType === "REAL") {
			const num = Number(value);
			if (!Number.isFinite(num)) {
				return "0";
			}
			return String(num);
		}

		// TEXT — escape single quotes via SQL standard doubling
		let text: string;
		if (typeof value === "string") {
			text = value;
		} else if (typeof value === "number" || typeof value === "boolean") {
			text = String(value);
		} else if (typeof value === "object" && value !== null) {
			text = JSON.stringify(value);
		} else {
			text = "";
		}
		return `'${text.replace(SINGLE_QUOTE_PATTERN, "''")}'`;
	}
private getEmptyDefault(fieldType: FieldType): string {
		if (fieldType === "blocks") return "'[]'";
		const columnType = FIELD_TYPE_TO_COLUMN[fieldType];

		switch (columnType) {
			case "INTEGER":
				return "0";
			case "REAL":
				return "0.0";
			case "JSON":
				return "'null'";
			default:
				return "''";
		}
	}
}
export async function createPinnedContentDDL(db,slug){const fixture=new PinnedContentDDL();await fixture.createContentTable(slug,db,[{slug:"title",label:"Title",type:"string"}]);}
