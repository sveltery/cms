/**
 * Column classification registry for every portable table.
 *
 * Every column of a portable table must appear here, and every table in the
 * database must be either portable or listed as non-portable. Exporter readers
 * and verification call {@link assertColumnCoverage} before reading a table,
 * so a migration that adds a column fails loudly until someone decides how
 * the column transfers.
 *
 * Classes:
 * - `field`: exported as the record property `property` using `codec`.
 * - `principal`: holds an origin user id; exported as `property` (a principal
 *   reference) and mapped through the plan's principal mappings on import.
 * - `mediaRef`: exported as `property`; its value may carry storage-key
 *   references, which the exporter rewrites to `emdash-media:` placeholders.
 * - `derived`: not exported; the importer computes it on the target.
 * - `excluded`: not exported; the target keeps the column default.
 * - `randomized`: not exported; the importer fills a fresh opaque value.
 * - `targetLocal`: not exported; the value belongs to the target installation.
 */
import { listTableColumns } from "../../database/dialect-helpers.js";
import { validateIdentifier } from "../../database/validate.js";
import { isStoragelessFieldRow } from "../../schema/types.js";
import { TransferError } from "../errors.js";
function f(property, codec = "text") {
    return { class: "field", property, codec };
}
function principal(property) {
    return { class: "principal", property, codec: "text" };
}
const EXCLUDED = { class: "excluded" };
const DERIVED = { class: "derived" };
const RANDOMIZED = { class: "randomized" };
const TARGET_LOCAL = { class: "targetLocal" };
const PORTABLE_TABLE_LIST = [
    {
        table: "_emdash_block_types",
        kind: "block_type",
        columns: {
            id: f("id"),
            slug: f("slug"),
            label: f("label"),
            description: f("description"),
            icon: f("icon"),
            category: f("category"),
            current_version: f("currentVersion", "integer"),
            source: f("source"),
            created_at: f("createdAt"),
            updated_at: f("updatedAt"),
        },
    },
    {
        table: "_emdash_block_type_versions",
        kind: "block_type_version",
        columns: {
            id: f("id"),
            block_type_id: f("blockTypeId"),
            version: f("version", "integer"),
            fields: f("fields", "json"),
            fingerprint: DERIVED,
            created_at: f("createdAt"),
            updated_at: f("updatedAt"),
        },
    },
    {
        table: "_emdash_collections",
        kind: "collection",
        columns: {
            id: f("id"),
            slug: f("slug"),
            label: f("label"),
            label_singular: f("labelSingular"),
            description: f("description"),
            icon: f("icon"),
            supports: f("supports", "json"),
            source: f("source"),
            created_at: f("createdAt"),
            updated_at: f("updatedAt"),
            search_config: f("searchConfig", "json"),
            has_seo: f("hasSeo", "boolean"),
            url_pattern: f("urlPattern"),
            comments_enabled: f("commentsEnabled", "boolean"),
            comments_moderation: f("commentsModeration"),
            comments_closed_after_days: f("commentsClosedAfterDays", "integer"),
            comments_auto_approve_users: f("commentsAutoApproveUsers", "boolean"),
            hidden: f("hidden", "boolean"),
            sort_order: f("sortOrder", "integer"),
            admin_config: f("adminConfig", "json"),
            title_field: f("titleField"),
            date_field: f("dateField"),
            routable: f("routable", "boolean"),
            edit_locking: f("editLocking", "boolean"),
            nav_group: f("navGroup"),
        },
    },
    {
        table: "_emdash_fields",
        kind: "field",
        columns: {
            id: f("id"),
            collection_id: f("collectionId"),
            slug: f("slug"),
            label: f("label"),
            type: f("type"),
            column_type: f("columnType"),
            required: f("required", "boolean"),
            unique: f("unique", "boolean"),
            default_value: f("defaultValue", "json"),
            validation: f("validation", "json"),
            widget: f("widget"),
            options: f("options", "json"),
            sort_order: f("sortOrder", "integer"),
            created_at: f("createdAt"),
            searchable: f("searchable", "boolean"),
            translatable: f("translatable", "boolean"),
            indexed: f("indexed", "boolean"),
        },
    },
    {
        table: "_emdash_taxonomy_defs",
        kind: "taxonomy_def",
        columns: {
            id: f("id"),
            name: f("name"),
            label: f("label"),
            label_singular: f("labelSingular"),
            hierarchical: f("hierarchical", "boolean"),
            collections: f("collections", "json"),
            created_at: f("createdAt"),
            locale: f("locale"),
            translation_group: f("translationGroup"),
        },
    },
    {
        table: "_emdash_relations",
        kind: "relation",
        columns: {
            id: f("id"),
            slug: f("slug"),
            parent_collection: f("parentCollection"),
            child_collection: f("childCollection"),
            parent_label: f("parentLabel"),
            child_label: f("childLabel"),
            parent_label_singular: f("parentLabelSingular"),
            child_label_singular: f("childLabelSingular"),
            max_children_per_parent: f("maxChildrenPerParent", "integer"),
            max_parents_per_child: f("maxParentsPerChild", "integer"),
            created_at: f("createdAt"),
            updated_at: f("updatedAt"),
        },
    },
    {
        table: "_emdash_byline_fields",
        kind: "byline_field",
        columns: {
            id: f("id"),
            slug: f("slug"),
            label: f("label"),
            type: f("type"),
            required: f("required", "boolean"),
            translatable: f("translatable", "boolean"),
            validation: f("validation", "json"),
            sort_order: f("sortOrder", "integer"),
            created_at: f("createdAt"),
            updated_at: f("updatedAt"),
        },
    },
    {
        table: "media_folders",
        kind: "media_folder",
        columns: {
            id: f("id"),
            name: f("name"),
            name_key: f("nameKey"),
        },
    },
    {
        table: "media",
        kind: "media",
        columns: {
            id: f("id"),
            filename: f("filename"),
            mime_type: f("mimeType"),
            size: f("size", "integer"),
            width: f("width", "integer"),
            height: f("height", "integer"),
            focal_x: f("focalX", "real"),
            focal_y: f("focalY", "real"),
            alt: f("alt"),
            caption: f("caption"),
            storage_key: TARGET_LOCAL,
            content_hash: DERIVED,
            status: DERIVED,
            blurhash: f("blurhash"),
            dominant_color: f("dominantColor"),
            created_at: f("createdAt"),
            author_id: principal("authorPrincipal"),
            folder_id: f("folderId"),
        },
    },
    {
        table: "taxonomies",
        kind: "term",
        columns: {
            id: f("id"),
            name: f("name"),
            slug: f("slug"),
            label: f("label"),
            parent_id: f("parentId"),
            data: f("data", "json"),
            locale: f("locale"),
            translation_group: f("translationGroup"),
            sort_order: f("sortOrder", "integer"),
        },
    },
    {
        table: "_emdash_bylines",
        kind: "byline",
        columns: {
            id: f("id"),
            slug: f("slug"),
            display_name: f("displayName"),
            bio: f("bio"),
            avatar_media_id: f("avatarMediaId"),
            website_url: f("websiteUrl"),
            user_id: principal("userPrincipal"),
            is_guest: f("isGuest", "boolean"),
            created_at: f("createdAt"),
            updated_at: f("updatedAt"),
            locale: f("locale"),
            translation_group: f("translationGroup"),
        },
    },
    {
        table: "_emdash_byline_field_values",
        kind: "byline_field_value",
        columns: {
            byline_id: f("bylineId"),
            field_id: f("fieldId"),
            value: f("value", "json"),
            created_at: f("createdAt"),
            updated_at: f("updatedAt"),
        },
    },
    {
        table: "_emdash_byline_field_group_values",
        kind: "byline_field_group_value",
        columns: {
            translation_group: f("bylineGroup"),
            field_id: f("fieldId"),
            value: f("value", "json"),
            created_at: f("createdAt"),
            updated_at: f("updatedAt"),
        },
    },
    {
        table: "revisions",
        kind: "revision",
        columns: {
            id: f("id"),
            collection: f("collection"),
            entry_id: f("entryId"),
            data: f("data", "json"),
            author_id: principal("authorPrincipal"),
            created_at: f("createdAt"),
        },
    },
    {
        table: "content_taxonomies",
        kind: "content_term",
        columns: {
            collection: f("collection"),
            entry_id: f("entryGroup"),
            taxonomy_id: f("termGroup"),
            status: EXCLUDED,
            scheduled_at: EXCLUDED,
            deleted_at: EXCLUDED,
            locale: EXCLUDED,
            published_at: EXCLUDED,
            created_at: EXCLUDED,
        },
    },
    {
        table: "_emdash_content_bylines",
        kind: "content_byline",
        columns: {
            id: f("id"),
            collection_slug: f("collection"),
            content_id: f("entryId"),
            byline_id: f("bylineGroup"),
            sort_order: f("sortOrder", "integer"),
            role_label: f("roleLabel"),
            created_at: f("createdAt"),
        },
    },
    {
        table: "_emdash_content_references",
        kind: "content_reference",
        columns: {
            id: f("id"),
            relation_id: f("relationId"),
            parent_group: f("parentGroup"),
            child_group: f("childGroup"),
            sort_order: f("sortOrder", "integer"),
            created_at: f("createdAt"),
        },
    },
    {
        table: "_emdash_seo",
        kind: "seo",
        columns: {
            collection: f("collection"),
            content_id: f("entryId"),
            seo_title: f("seoTitle"),
            seo_description: f("seoDescription"),
            seo_image: { class: "mediaRef", property: "seoImage", codec: "text" },
            seo_canonical: f("seoCanonical"),
            seo_no_index: f("seoNoIndex", "boolean"),
            created_at: f("createdAt"),
            updated_at: f("updatedAt"),
        },
    },
    {
        table: "_emdash_menus",
        kind: "menu",
        columns: {
            id: f("id"),
            name: f("name"),
            label: f("label"),
            created_at: f("createdAt"),
            updated_at: f("updatedAt"),
            locale: f("locale"),
            translation_group: f("translationGroup"),
        },
    },
    {
        table: "_emdash_menu_items",
        kind: "menu_item",
        columns: {
            id: f("id"),
            menu_id: f("menuId"),
            parent_id: f("parentId"),
            sort_order: f("sortOrder", "integer"),
            type: f("type"),
            reference_collection: f("referenceCollection"),
            reference_id: f("referenceGroup"),
            custom_url: f("customUrl"),
            label: f("label"),
            title_attr: f("titleAttr"),
            target: f("target"),
            css_classes: f("cssClasses"),
            created_at: f("createdAt"),
            locale: f("locale"),
            translation_group: f("translationGroup"),
        },
    },
    {
        table: "_emdash_widget_areas",
        kind: "widget_area",
        columns: {
            id: f("id"),
            name: f("name"),
            label: f("label"),
            description: f("description"),
            created_at: f("createdAt"),
        },
    },
    {
        table: "_emdash_widgets",
        kind: "widget",
        columns: {
            id: f("id"),
            area_id: f("areaId"),
            sort_order: f("sortOrder", "integer"),
            type: f("type"),
            title: f("title"),
            content: f("content", "json"),
            menu_name: f("menuName"),
            component_id: f("componentId"),
            component_props: f("componentProps", "json"),
            created_at: f("createdAt"),
        },
    },
    {
        table: "_emdash_sections",
        kind: "section",
        columns: {
            id: f("id"),
            slug: f("slug"),
            title: f("title"),
            description: f("description"),
            keywords: f("keywords", "json"),
            content: f("content", "json"),
            preview_media_id: f("previewMediaId"),
            source: f("source"),
            theme_id: f("themeId"),
            created_at: f("createdAt"),
            updated_at: f("updatedAt"),
        },
    },
    {
        table: "_emdash_redirects",
        kind: "redirect",
        columns: {
            id: f("id"),
            source: f("source"),
            destination: f("destination"),
            type: f("type", "integer"),
            is_pattern: f("isPattern", "boolean"),
            enabled: f("enabled", "boolean"),
            hits: EXCLUDED,
            last_hit_at: EXCLUDED,
            group_name: f("groupName"),
            auto: f("auto", "boolean"),
            created_at: f("createdAt"),
            updated_at: f("updatedAt"),
            config_revision: DERIVED,
            source_guard: DERIVED,
            write_generation: DERIVED,
        },
    },
    {
        table: "_emdash_comments",
        kind: "comment",
        columns: {
            id: f("id"),
            collection: f("collection"),
            content_id: f("entryId"),
            parent_id: f("parentId"),
            author_name: f("authorName"),
            author_email: f("authorEmail"),
            author_user_id: principal("authorPrincipal"),
            body: f("body"),
            status: f("status"),
            ip_hash: EXCLUDED,
            user_agent: EXCLUDED,
            moderation_metadata: f("moderationMetadata", "json"),
            created_at: f("createdAt"),
            updated_at: f("updatedAt"),
        },
    },
    {
        table: "_emdash_comment_reactions",
        kind: "comment_reaction",
        columns: {
            id: f("id"),
            comment_id: f("commentId"),
            reaction: f("reaction"),
            voter_hash: RANDOMIZED,
            created_at: f("createdAt"),
        },
    },
    {
        table: "options",
        kind: "setting",
        columns: {
            name: f("id"),
            value: f("value", "json"),
            revision: DERIVED,
        },
    },
];
export const PORTABLE_TABLES = Object.freeze(PORTABLE_TABLE_LIST);
/** Standard columns of every `ec_*` content table (kind `entry`). */
export const CONTENT_TABLE_COLUMNS = Object.freeze({
    id: f("id"),
    slug: f("slug"),
    status: f("status"),
    author_id: principal("authorPrincipal"),
    primary_byline_id: f("primaryBylineGroup"),
    created_at: f("createdAt"),
    updated_at: f("updatedAt"),
    published_at: f("publishedAt"),
    scheduled_at: f("scheduledAt"),
    deleted_at: f("deletedAt"),
    version: f("version", "integer"),
    live_revision_id: f("liveRevisionId"),
    draft_revision_id: f("draftRevisionId"),
    locale: f("locale"),
    translation_group: f("translationGroup"),
});
export const CONTENT_TABLE_PREFIX = "ec_";
/**
 * Tables that never transfer, with the reason. Every table a migration
 * creates must be portable or listed here (or match a non-portable prefix).
 */
export const NON_PORTABLE_TABLES = Object.freeze({
    users: "auth",
    credentials: "auth",
    auth_tokens: "auth",
    oauth_accounts: "auth",
    allowed_domains: "auth",
    auth_challenges: "auth",
    _emdash_api_tokens: "auth",
    _emdash_oauth_tokens: "auth",
    _emdash_oauth_clients: "auth",
    _emdash_authorization_codes: "auth",
    _emdash_device_codes: "auth",
    _emdash_rate_limits: "runtime",
    _emdash_entry_locks: "runtime",
    _emdash_cron_tasks: "runtime",
    _emdash_redirect_write_lock: "runtime",
    _emdash_redirect_state: "derived",
    _emdash_redirect_artifacts: "derived",
    _emdash_redirect_generation_artifacts: "derived",
    _emdash_404_log: "runtime",
    _emdash_revision_prune_queue: "runtime",
    _emdash_media_upload_attempts: "runtime",
    _emdash_media_usage: "derived",
    _emdash_media_usage_sources: "derived",
    _emdash_media_usage_cleanup: "runtime",
    _emdash_media_usage_cleanup_fence: "runtime",
    _emdash_media_usage_generation_writes: "runtime",
    _emdash_media_usage_index_status: "derived",
    _emdash_media_usage_activation: "runtime",
    _emdash_media_usage_work: "runtime",
    _emdash_media_usage_collection_deletions: "runtime",
    _emdash_media_usage_reconciliations: "runtime",
    _emdash_taxonomy_def_groups: "derived",
    audit_logs: "audit",
    _emdash_migrations: "migrations",
    _emdash_migrations_lock: "migrations",
    _plugin_storage: "plugin",
    _plugin_state: "plugin",
    _plugin_indexes: "plugin",
});
export const NON_PORTABLE_TABLE_PREFIXES = Object.freeze([
    "_emdash_fts_",
    "_emdash_transfer_",
    "_plugin_",
    "sqlite_",
]);
const PORTABLE_BY_TABLE = new Map(PORTABLE_TABLES.map((spec) => [spec.table, spec]));
const PORTABLE_BY_KIND = new Map(PORTABLE_TABLES.map((spec) => [spec.kind, spec]));
export function isContentTableName(table) {
    return table.startsWith(CONTENT_TABLE_PREFIX);
}
export function getPortableTableSpec(table) {
    return PORTABLE_BY_TABLE.get(table);
}
/** The table for a kind; `entry` lives in `ec_*` tables and `principal` in none. */
export function getPortableTableSpecForKind(kind) {
    return PORTABLE_BY_KIND.get(kind);
}
export function classifyTable(table) {
    if (PORTABLE_BY_TABLE.has(table))
        return "portable";
    if (isContentTableName(table))
        return "content";
    if (Object.hasOwn(NON_PORTABLE_TABLES, table))
        return "nonPortable";
    if (NON_PORTABLE_TABLE_PREFIXES.some((prefix) => table.startsWith(prefix)))
        return "nonPortable";
    return "unclassified";
}
/**
 * Column classification for a table in `db`. For an `ec_*` table the
 * standard columns come from {@link CONTENT_TABLE_COLUMNS} and each column
 * named by a registered field of that collection is a generic `field`
 * (property = field slug, codec from the field's column type).
 */
export async function getColumnSpecs(db, table) {
    const spec = PORTABLE_BY_TABLE.get(table);
    if (spec)
        return spec.columns;
    if (!isContentTableName(table)) {
        throw new TransferError("TRANSFER_SCHEMA_UNCLASSIFIED", "Table is not portable", {
            detail: { table },
        });
    }
    const slug = table.slice(CONTENT_TABLE_PREFIX.length);
    validateIdentifier(slug, "collection slug");
    const fields = await db
        .selectFrom("_emdash_fields")
        .innerJoin("_emdash_collections", "_emdash_collections.id", "_emdash_fields.collection_id")
        .select([
        "_emdash_fields.slug as slug",
        "_emdash_fields.column_type as column_type",
        "_emdash_fields.type as type",
        "_emdash_fields.validation as validation",
    ])
        .where("_emdash_collections.slug", "=", slug)
        .execute();
    return contentColumnSpecs(fields, await listTableColumns(db, table));
}
/**
 * Column classification of an `ec_*` table from its collection's registered
 * fields and the table's declared columns (see {@link getColumnSpecs}).
 *
 * A storage-less field's values are content references, not a column. A
 * column left under its slug from before the field was bound is excluded.
 */
export function contentColumnSpecs(fields, tableColumns) {
    const declared = new Map(tableColumns.map((column) => [column.name, column.type.toLowerCase()]));
    const columns = { ...CONTENT_TABLE_COLUMNS };
    for (const field of fields) {
        if (Object.hasOwn(columns, field.slug))
            continue;
        if (isStoragelessFieldRow(field)) {
            columns[field.slug] = EXCLUDED;
            continue;
        }
        let codec = codecForColumnType(field.column_type);
        if (codec === "nativeJson" && !JSON_COLUMN_TYPES.has(declared.get(field.slug) ?? "")) {
            codec = "json";
        }
        columns[field.slug] = f(field.slug, codec);
    }
    return columns;
}
const JSON_COLUMN_TYPES = new Set(["json", "jsonb"]);
export function codecForColumnType(columnType) {
    switch (columnType) {
        case "INTEGER":
            return "integer";
        case "REAL":
            return "real";
        case "JSON":
            return "nativeJson";
        default:
            return "text";
    }
}
/** Columns present in `table` that the registry does not classify. */
export async function listUnclassifiedColumns(db, table) {
    const specs = await getColumnSpecs(db, table);
    const columns = await listTableColumns(db, table);
    return columns.map((column) => column.name).filter((name) => !Object.hasOwn(specs, name));
}
/**
 * Throw `TRANSFER_SCHEMA_UNCLASSIFIED` unless every column of `table` is
 * classified. Readers call this before reading a table so an unclassified
 * column is never silently dropped from (or leaked into) a package.
 */
export async function assertColumnCoverage(db, table) {
    assertCoverage(table, await listUnclassifiedColumns(db, table));
}
/** {@link assertColumnCoverage} for a table whose columns and specs are already loaded. */
export function assertLoadedColumnCoverage(table, specs, tableColumns) {
    assertCoverage(table, tableColumns.map((column) => column.name).filter((name) => !Object.hasOwn(specs, name)));
}
function assertCoverage(table, unclassified) {
    if (unclassified.length > 0) {
        throw new TransferError("TRANSFER_SCHEMA_UNCLASSIFIED", `Table ${table} has columns without a transfer classification`, { detail: { table, columns: unclassified.join(",") } });
    }
}
