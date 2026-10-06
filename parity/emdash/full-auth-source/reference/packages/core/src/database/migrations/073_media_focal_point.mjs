import { columnExists } from "../dialect-helpers.js";
const DUPLICATE_COLUMN_RE = /(?:duplicate column|column .* already exists|already exists.*column)/i;
export async function up(db) {
    await addFocalColumnIfMissing(db, "focal_x", () => db.schema.alterTable("media").addColumn("focal_x", "real").execute());
    await addFocalColumnIfMissing(db, "focal_y", () => db.schema.alterTable("media").addColumn("focal_y", "real").execute());
}
export async function down(db) {
    if (await columnExists(db, "media", "focal_y")) {
        await db.schema.alterTable("media").dropColumn("focal_y").execute();
    }
    if (await columnExists(db, "media", "focal_x")) {
        await db.schema.alterTable("media").dropColumn("focal_x").execute();
    }
}
export async function addFocalColumnIfMissing(db, column, addColumn) {
    if (await columnExists(db, "media", column))
        return;
    try {
        await addColumn();
    }
    catch (error) {
        if (DUPLICATE_COLUMN_RE.test(deepErrorMessage(error))) {
            if (await columnExists(db, "media", column))
                return;
        }
        throw error;
    }
}
function deepErrorMessage(error) {
    if (error instanceof Error) {
        const own = error.message ?? "";
        if (error.cause) {
            const causeMessage = deepErrorMessage(error.cause);
            return own ? `${own}: ${causeMessage}` : causeMessage;
        }
        return own;
    }
    if (typeof error === "string")
        return error;
    try {
        return JSON.stringify(error);
    }
    catch {
        return String(error);
    }
}
