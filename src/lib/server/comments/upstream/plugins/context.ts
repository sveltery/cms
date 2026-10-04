import { sql, type Kysely } from 'kysely';
import type { Database } from '../database/types.ts';
import type { PluginContext, ResolvedPlugin, UserInfo } from './types.ts';
export interface PluginContextFactoryOptions { db: Kysely<Database>; getDb?: () => Kysely<Database> }
/** Bounded trusted comment provider context with actual current-user/profile reads. */
export function createCommentPluginContext(plugin: ResolvedPlugin, options: PluginContextFactoryOptions): PluginContext {
 const db = options.getDb?.() ?? options.db;
 return Object.freeze({
  log: Object.freeze({ info: console.info, warn: console.warn, error: console.error }),
  ...(plugin.capabilities.includes('users:read') ? { users: Object.freeze({ async get(id: string): Promise<UserInfo | null> {
   const row = (await sql<{ id: string; email: string; name: string | null; role: number; created_at: string }>`
    SELECT u.id, u.role, p.email, p.name, p.created_at FROM _cms_auth_users u
    JOIN _cms_auth_profiles p ON p.user_id = u.id WHERE u.id = ${id}
   `.execute(db)).rows[0];
   return row ? { id: row.id, email: row.email, name: row.name, role: row.role, createdAt: row.created_at } : null;
  } }) } : {})
 });
}
