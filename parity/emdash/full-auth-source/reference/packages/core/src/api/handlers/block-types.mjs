import { invalidateCollectionCache } from "../../object-cache/index.js";
import { BlockTypeRegistry, SchemaError, invalidateSchemaCache, } from "../../schema/index.js";
function schemaError(error) {
    return {
        success: false,
        error: { code: error.code, message: error.message, details: error.details },
    };
}
async function invalidateConsumers(db, slug) {
    const collections = await new BlockTypeRegistry(db).listAffectedCollections(slug);
    for (const collection of collections) {
        invalidateCollectionCache(collection);
        invalidateSchemaCache(collection);
    }
}
export async function handleBlockTypeList(db) {
    try {
        return { success: true, data: { items: await new BlockTypeRegistry(db).listBlockTypes() } };
    }
    catch {
        return {
            success: false,
            error: { code: "SCHEMA_LIST_ERROR", message: "Failed to list block types" },
        };
    }
}
export async function handleBlockTypeGet(db, slug) {
    try {
        const item = await new BlockTypeRegistry(db).getBlockType(slug);
        if (!item) {
            return {
                success: false,
                error: { code: "BLOCK_TYPE_NOT_FOUND", message: `Block type '${slug}' not found` },
            };
        }
        return { success: true, data: { item } };
    }
    catch (error) {
        if (error instanceof SchemaError)
            return schemaError(error);
        return {
            success: false,
            error: { code: "SCHEMA_GET_ERROR", message: "Failed to get block type" },
        };
    }
}
export async function handleBlockTypeCreate(db, input) {
    try {
        const item = await new BlockTypeRegistry(db).createBlockType(input);
        await invalidateConsumers(db, input.slug);
        return { success: true, data: { item } };
    }
    catch (error) {
        if (error instanceof SchemaError)
            return schemaError(error);
        return {
            success: false,
            error: { code: "SCHEMA_CREATE_ERROR", message: "Failed to create block type" },
        };
    }
}
export async function handleBlockTypeUpdate(db, slug, input) {
    try {
        const item = await new BlockTypeRegistry(db).updateBlockType(slug, input);
        await invalidateConsumers(db, slug);
        return { success: true, data: { item } };
    }
    catch (error) {
        if (error instanceof SchemaError)
            return schemaError(error);
        return {
            success: false,
            error: { code: "SCHEMA_UPDATE_ERROR", message: "Failed to update block type" },
        };
    }
}
export async function handleBlockTypeVersionActivate(db, slug, version, expectedFingerprint) {
    try {
        const item = await new BlockTypeRegistry(db).activateVersion(slug, version, expectedFingerprint);
        await invalidateConsumers(db, slug);
        return { success: true, data: { item } };
    }
    catch (error) {
        if (error instanceof SchemaError)
            return schemaError(error);
        return {
            success: false,
            error: { code: "SCHEMA_UPDATE_ERROR", message: "Failed to activate block type version" },
        };
    }
}
