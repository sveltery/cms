// Identity projections/first-admin guard adapt EmDash 1.1.0; see notices/emdash-MIT.txt.
// Pin 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e:
// packages/auth/src/adapters/kysely.ts and packages/core/src/api/setup-complete.ts.
import { sql, type Kysely } from 'kysely';
import { ulid } from 'ulidx';
import type { CmsDatabase } from '../database/contract.ts';
import type { AuthTables } from './schema.ts';
import type { AuthIdentityTables } from './identity-migrations.ts';
import type { AuthAdapter, Credential, NewCredential, User } from './vendor/types.ts';
import { toDeviceType, toRoleLevel } from './vendor/types.ts';

type Tables = AuthTables & AuthIdentityTables;
export function identityDb(database: CmsDatabase): Kysely<Tables> {
  return database.db as unknown as Kysely<Tables>;
}
export function identityOptions(database: CmsDatabase) {
  const db = identityDb(database);
  return {
    async get<T = unknown>(key: string): Promise<T | null> {
      const row = await db.selectFrom('_cms_auth_setup').select('value').where('key', '=', key).executeTakeFirst();
      return row ? JSON.parse(row.value) as T : null;
    },
    async set(key: string, value: unknown) {
      await db.insertInto('_cms_auth_setup').values({ key, value: JSON.stringify(value) })
        .onConflict(oc => oc.column('key').doUpdateSet({ value: JSON.stringify(value) })).execute();
    },
    async delete(key: string) { await db.deleteFrom('_cms_auth_setup').where('key', '=', key).execute(); }
  };
}
/** Older minimal users have no verified identity metadata to enroll automatically. */
export async function hasProfilelessUsers(database: CmsDatabase): Promise<boolean> {
  return !!await identityDb(database).selectFrom('_cms_auth_users as u')
    .leftJoin('_cms_auth_profiles as p', 'p.user_id', 'u.id').select('u.id')
    .where('p.user_id', 'is', null).limit(1).executeTakeFirst();
}
function credential(row: AuthIdentityTables['_cms_auth_credentials']): Credential {
  return { id: row.id, userId: row.user_id,
    publicKey: row.public_key instanceof Uint8Array ? row.public_key : new Uint8Array(row.public_key),
    algorithm: row.algorithm, counter: row.counter, deviceType: toDeviceType(row.device_type),
    backedUp: row.backed_up === 1, transports: row.transports ? JSON.parse(row.transports) : [], name: row.name,
    createdAt: new Date(row.created_at), lastUsedAt: new Date(row.last_used_at) };
}
/** Only the operations consumed by the pinned passkey algorithms are supplied. */
export function identityAdapter(database: CmsDatabase): Pick<AuthAdapter,
  'getUserById' | 'getUserByEmail' | 'countUsers' | 'getCredentialById' | 'getCredentialsByUserId' |
  'createCredential' | 'updateCredentialCounter' | 'countCredentialsByUserId'> {
  const db = identityDb(database);
  const userQuery = () => db.selectFrom('_cms_auth_users as u').innerJoin('_cms_auth_profiles as p', 'p.user_id', 'u.id')
    .select(['u.id', 'u.role', 'u.disabled', 'p.email', 'p.name', 'p.avatar_url', 'p.email_verified', 'p.data', 'p.created_at', 'p.updated_at']);
  const project = (row: Awaited<ReturnType<ReturnType<typeof userQuery>['executeTakeFirst']>>): User | null => row ? {
    id: row.id, email: row.email, name: row.name, avatarUrl: row.avatar_url, role: toRoleLevel(row.role),
    disabled: row.disabled === 1, emailVerified: row.email_verified === 1, data: row.data ? JSON.parse(row.data) : null,
    createdAt: new Date(row.created_at), updatedAt: new Date(row.updated_at)
  } : null;
  return {
    async getUserById(id) { return project(await userQuery().where('u.id', '=', id).executeTakeFirst()); },
    async getUserByEmail(email) { return project(await userQuery().where('p.email', '=', email.toLowerCase()).executeTakeFirst()); },
    async countUsers() { return Number((await db.selectFrom('_cms_auth_users').select(eb => eb.fn.countAll<number>().as('count')).executeTakeFirstOrThrow()).count); },
    async getCredentialById(id) { const row = await db.selectFrom('_cms_auth_credentials').selectAll().where('id', '=', id).executeTakeFirst(); return row ? credential(row) : null; },
    async getCredentialsByUserId(userId) { return (await db.selectFrom('_cms_auth_credentials').selectAll().where('user_id', '=', userId).execute()).map(credential); },
    async createCredential(input: NewCredential) {
      const now = new Date().toISOString();
      const row = await db.insertInto('_cms_auth_credentials').values({ id: input.id, user_id: input.userId,
        public_key: input.publicKey, algorithm: input.algorithm, counter: input.counter, device_type: input.deviceType,
        backed_up: input.backedUp ? 1 : 0, transports: JSON.stringify(input.transports), name: input.name ?? null,
        created_at: now, last_used_at: now }).returningAll().executeTakeFirstOrThrow();
      return credential(row);
    },
    async updateCredentialCounter(id, counter) { await db.updateTable('_cms_auth_credentials').set({ counter, last_used_at: new Date().toISOString() }).where('id', '=', id).execute(); },
    async countCredentialsByUserId(userId) { return Number((await db.selectFrom('_cms_auth_credentials').select(eb => eb.fn.countAll<number>().as('count')).where('user_id', '=', userId).executeTakeFirstOrThrow()).count); }
  };
}

/** Mirrors the immutable empty-users insert guard; profile mapping joins the same atomic batch. */
export async function createFirstAdmin(database: CmsDatabase, input: { email: string; name: string | null }): Promise<User | null> {
  const db = identityDb(database), id = ulid(), now = new Date().toISOString();
  const statements = [
    sql`INSERT INTO _cms_auth_users (id,role,disabled)
      SELECT ${id},50,0 WHERE NOT EXISTS (SELECT 1 FROM _cms_auth_users) RETURNING id`.compile(db),
    sql`INSERT INTO _cms_auth_profiles (user_id,email,name,avatar_url,email_verified,data,created_at,updated_at)
      SELECT ${id},${input.email.toLowerCase()},${input.name},NULL,0,NULL,${now},${now}
      WHERE EXISTS (SELECT 1 FROM _cms_auth_users WHERE id = ${id})`.compile(db)
  ];
  const results = await database.atomicBatch(statements);
  return results[0].rows.length ? identityAdapter(database).getUserById(id) : null;
}
