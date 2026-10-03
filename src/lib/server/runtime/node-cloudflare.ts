/** Cloudflare builds use D1. No unsupported Node SQLite module enters the Worker graph. */
export async function openRuntimeSqlite(_path: string): Promise<never> {
  throw new Error('SVELTERY_DATABASE_PATH is unavailable on Cloudflare; configure a D1 binding in d1_databases');
}
