import { DatabaseSync } from "node:sqlite";
export function openNodeSqliteDatabase(path, options = {}) {
    return new NodeSqliteCompatDatabase(path, options);
}
export class NodeSqliteCompatDatabase {
    #database;
    constructor(path, options = {}) {
        const database = new DatabaseSync(path, { readOnly: options.readOnly });
        this.#database = database;
        try {
            database.exec("PRAGMA busy_timeout = 5000");
            database.exec("PRAGMA foreign_keys = ON");
            // Negative cache_size values are kibibytes.
            database.exec("PRAGMA cache_size = -16000");
            if (options.journalMode === "wal" && !options.readOnly) {
                database.exec("PRAGMA journal_mode = WAL");
            }
            const journalMode = database.prepare("PRAGMA journal_mode").get()?.["journal_mode"];
            if (journalMode === "wal") {
                database.exec("PRAGMA synchronous = NORMAL");
            }
        }
        catch (error) {
            try {
                database.close();
            }
            catch {
                throw new Error("SQLite setup failed and the connection could not be closed", {
                    cause: error,
                });
            }
            throw error;
        }
    }
    get open() {
        return this.#database.isOpen;
    }
    close() {
        if (this.#database.isOpen)
            this.#database.close();
    }
    exec(sql) {
        this.#database.exec(sql);
    }
    prepare(sql) {
        const statement = this.#database.prepare(sql);
        return {
            reader: statement.columns().length > 0,
            all: (...parameters) => statement.all(...toBindings(normalizeParameters(parameters))),
            get: (...parameters) => statement.get(...toBindings(normalizeParameters(parameters))),
            run: (...parameters) => statement.run(...toBindings(normalizeParameters(parameters))),
            iterate: (...parameters) => statement.iterate(...toBindings(normalizeParameters(parameters))),
        };
    }
}
function normalizeParameters(parameters) {
    return parameters.length === 1 && Array.isArray(parameters[0]) ? parameters[0] : parameters;
}
function toBindings(parameters) {
    return parameters.map((value) => {
        if (value === null || typeof value === "string" || typeof value === "number") {
            return value;
        }
        if (typeof value === "bigint")
            return value;
        if (typeof value === "boolean")
            return value ? 1 : 0;
        if (value === undefined)
            return null;
        if (value instanceof Uint8Array)
            return value;
        throw new TypeError(`Cannot bind ${Object.prototype.toString.call(value)} to SQLite`);
    });
}
