import { MediaFolderRepository, } from "../../database/repositories/media-folders.js";
import { EmDashValidationError, InvalidCursorError } from "../../database/repositories/types.js";
const UNIQUE_VIOLATION_RE = /unique constraint failed|duplicate key value violates unique constraint/i;
export async function handleMediaFolderList(db, options = {}) {
    try {
        const result = await new MediaFolderRepository(db).findMany(options);
        return { success: true, data: result };
    }
    catch (error) {
        if (error instanceof InvalidCursorError) {
            return { success: false, error: { code: "INVALID_CURSOR", message: error.message } };
        }
        return {
            success: false,
            error: { code: "MEDIA_FOLDER_LIST_ERROR", message: "Failed to list media folders" },
        };
    }
}
export async function handleMediaFolderGet(db, id) {
    try {
        const item = await new MediaFolderRepository(db).findById(id);
        if (!item) {
            return { success: false, error: { code: "NOT_FOUND", message: "Media folder not found" } };
        }
        return { success: true, data: { item } };
    }
    catch {
        return {
            success: false,
            error: { code: "MEDIA_FOLDER_GET_ERROR", message: "Failed to get media folder" },
        };
    }
}
export async function handleMediaFolderCreate(db, input) {
    try {
        const item = await new MediaFolderRepository(db).create(input.name);
        return { success: true, data: { item } };
    }
    catch (error) {
        return mediaFolderWriteError(error, "MEDIA_FOLDER_CREATE_ERROR", "Failed to create media folder");
    }
}
export async function handleMediaFolderUpdate(db, id, input) {
    try {
        const item = await new MediaFolderRepository(db).update(id, input.name);
        if (!item) {
            return { success: false, error: { code: "NOT_FOUND", message: "Media folder not found" } };
        }
        return { success: true, data: { item } };
    }
    catch (error) {
        return mediaFolderWriteError(error, "MEDIA_FOLDER_UPDATE_ERROR", "Failed to update media folder");
    }
}
export async function handleMediaFolderDelete(db, id) {
    try {
        const deleted = await new MediaFolderRepository(db).delete(id);
        if (!deleted) {
            return { success: false, error: { code: "NOT_FOUND", message: "Media folder not found" } };
        }
        return { success: true, data: { deleted: true } };
    }
    catch {
        return {
            success: false,
            error: { code: "MEDIA_FOLDER_DELETE_ERROR", message: "Failed to delete media folder" },
        };
    }
}
function mediaFolderWriteError(error, code, message) {
    if (error instanceof EmDashValidationError) {
        return { success: false, error: { code: "VALIDATION_ERROR", message: error.message } };
    }
    if (isUniqueViolation(error)) {
        return {
            success: false,
            error: { code: "CONFLICT", message: "A media folder with this name already exists" },
        };
    }
    return { success: false, error: { code, message } };
}
function isUniqueViolation(error) {
    if (error && typeof error === "object") {
        if ("code" in error && error.code === "23505")
            return true;
    }
    const message = error instanceof Error ? error.message : "";
    if (UNIQUE_VIOLATION_RE.test(message))
        return true;
    return Boolean(error && typeof error === "object" && "cause" in error && isUniqueViolation(error.cause));
}
