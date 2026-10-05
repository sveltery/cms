/**
 * Database Adapter Functions
 *
 * These run at config time (astro.config.mjs) and return serializable descriptors.
 * The actual dialect is created at runtime by loading the entrypoint.
 *
 * @example
 * ```ts
 * // astro.config.mjs
 * import emdash from "emdash/astro";
 * import { sqlite } from "emdash/db";
 *
 * export default defineConfig({
 *   integrations: [
 *     emdash({
 *       database: sqlite({ url: "file:./data.db" }),
 *     }),
 *   ],
 * });
 * ```
 */
const ENVIRONMENT_VARIABLE_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
function migrationEnvironmentVariable(value, fallback, optionName) {
    const name = value ?? fallback;
    if (!ENVIRONMENT_VARIABLE_PATTERN.test(name)) {
        throw new Error(`${optionName} must be a valid environment variable name.`);
    }
    return name;
}
/**
 * SQLite database adapter (node:sqlite)
 *
 * For local development and Node.js deployments. Requires Node.js 22.16 or later.
 *
 * @example
 * ```ts
 * database: sqlite({ url: "file:./data.db" })
 * ```
 */
export function sqlite(config) {
    return {
        entrypoint: "emdash/db/sqlite",
        config,
        type: "sqlite",
        migrations: {
            entrypoint: "emdash/internal/db/sqlite-migrations",
            manifestConfig: { url: config.url },
        },
    };
}
/**
 * libSQL database adapter (Turso)
 *
 * For Turso hosted databases or local libSQL.
 *
 * @example
 * ```ts
 * database: libsql({
 *   url: "libsql://my-db.turso.io",
 *   authToken: process.env.TURSO_AUTH_TOKEN,
 * })
 * ```
 */
export function libsql(config) {
    const { migrationAuthTokenEnv, ...runtimeConfig } = config;
    return {
        entrypoint: "emdash/db/libsql",
        config: runtimeConfig,
        type: "sqlite",
        migrations: {
            entrypoint: "emdash/internal/db/libsql-migrations",
            manifestConfig: {
                url: config.url,
                authTokenEnv: migrationEnvironmentVariable(migrationAuthTokenEnv, "TURSO_AUTH_TOKEN", "migrationAuthTokenEnv"),
            },
        },
    };
}
/**
 * PostgreSQL database adapter
 *
 * For PostgreSQL deployments with connection pooling.
 *
 * @example
 * ```ts
 * database: postgres({ connectionString: process.env.DATABASE_URL })
 * ```
 */
export function postgres(config) {
    const { migrationConnectionStringEnv, ...runtimeConfig } = config;
    return {
        entrypoint: "emdash/db/postgres",
        config: runtimeConfig,
        type: "postgres",
        migrations: {
            entrypoint: "emdash/internal/db/postgres-migrations",
            manifestConfig: {
                connectionStringEnv: migrationEnvironmentVariable(migrationConnectionStringEnv, "DATABASE_URL", "migrationConnectionStringEnv"),
            },
        },
    };
}
