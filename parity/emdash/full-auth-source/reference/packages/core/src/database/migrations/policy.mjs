import { getExactMigrationStatus, runMigrations } from "./runner.js";
function parseMigrationMode(value, source) {
    if (value === "auto" || value === "check" || value === "manual") {
        return value;
    }
    throw new Error(`Invalid ${source} value ${JSON.stringify(value)}; expected "auto", "check", or "manual"`);
}
export function normalizeMigrationConfig(value) {
    if (value === undefined)
        return { runtime: "auto" };
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new Error("Invalid migrations configuration; expected an object");
    }
    const runtimeValue = Reflect.get(value, "runtime");
    const devValue = Reflect.get(value, "dev");
    const runtime = parseMigrationMode(runtimeValue, "migrations.runtime");
    const dev = devValue === undefined ? undefined : parseMigrationMode(devValue, "migrations.dev");
    return dev === undefined ? { runtime } : { runtime, dev };
}
export function resolveRuntimeMigrationMode(config, options) {
    if (options.override !== undefined) {
        return parseMigrationMode(options.override, "EMDASH_MIGRATIONS_MODE");
    }
    if (options.dev)
        return config?.dev ?? "auto";
    return config?.runtime ?? "auto";
}
export class PendingMigrationsError extends Error {
    pending;
    constructor(pending) {
        super(`Database has pending EmDash migrations: ${pending.join(", ")}`);
        this.name = "PendingMigrationsError";
        this.pending = [...pending];
    }
}
export async function enforceRuntimeMigrationPolicy(db, mode) {
    if (mode === "manual")
        return;
    if (mode === "auto") {
        await runMigrations(db);
        return;
    }
    const status = await getExactMigrationStatus(db);
    if (status.pending.length > 0) {
        throw new PendingMigrationsError(status.pending);
    }
}
