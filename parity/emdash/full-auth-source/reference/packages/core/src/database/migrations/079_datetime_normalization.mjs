import { normalizeDatetimeStorage } from "../datetime-storage.js";
export async function up(db) {
    // eslint-disable-next-line typescript/no-unsafe-type-assertion -- the migration runs after the typed tables exist
    await normalizeDatetimeStorage(db);
}
export async function down(_db) {
    // UTC normalization is intentionally irreversible because the original notation carried no extra data.
}
