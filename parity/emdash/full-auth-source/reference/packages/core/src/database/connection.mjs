import { Kysely, SqliteDialect } from "kysely";
import { openNodeSqliteDatabase } from "../db/node-sqlite-compat.js";
import { EmDashDatabaseError } from "./errors.js";
import { kyselyLogOption } from "./instrumentation.js";
export { EmDashDatabaseError };
/**
 * Creates a Kysely database instance
 * Supports:
 * - file:./path/to/db.sqlite (local SQLite)
 * - :memory: (in-memory SQLite for testing)
 * - libsql://... (Turso/libSQL with auth token) - TODO
 */
export function createDatabase(config) {
    try {
        // Handle file-based SQLite
        if (config.url.startsWith("file:") || config.url === ":memory:") {
            const dbPath = config.url === ":memory:" ? ":memory:" : config.url.replace("file:", "");
            const sqlite = openNodeSqliteDatabase(dbPath, {
                journalMode: "wal",
                readOnly: config.readOnly,
            });
            const dialect = new SqliteDialect({
                database: sqlite,
            });
            return new Kysely({ dialect, log: kyselyLogOption() });
        }
        // Handle libSQL (Turso)
        if (config.url.startsWith("libsql:")) {
            if (!config.authToken) {
                throw new EmDashDatabaseError("Auth token required for remote libSQL database");
            }
            // LibSQL implementation would use @libsql/kysely-libsql
            throw new EmDashDatabaseError("LibSQL not yet implemented");
        }
        throw new EmDashDatabaseError(`Unsupported database URL scheme: ${config.url}`);
    }
    catch (error) {
        if (error instanceof EmDashDatabaseError) {
            throw error;
        }
        throw new EmDashDatabaseError("Failed to create database", error);
    }
}
