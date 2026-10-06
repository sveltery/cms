// Adapted from EmDash 1.1.0 UserRepository at
// 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e:packages/core/src/database/repositories/user.ts.
// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// The existing Native identity/profile split uses the real CmsDatabase atomic adapter.
import { sql, type Updateable } from 'kysely';
import { ulid } from 'ulidx';
import { chunks, SQL_BATCH_SIZE } from '../schema/chunks.ts';
import { encodeCursor, decodeCursor } from '../database/trash-cursor.ts';
import type { CmsDatabase, CmsTables, Page } from '../database/contract.ts';

/** Valid Source roles: subscriber, contributor, author, editor, administrator. */
export type UserRole = 10 | 20 | 30 | 40 | 50;
export type UserRoleName = 'subscriber' | 'contributor' | 'author' | 'editor' | 'admin';
export interface User {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  avatarUrl: string | null;
  emailVerified: boolean;
  data: Record<string, unknown> | null;
  createdAt: string;
}
export interface CreateUserInput {
  email: string;
  name?: string;
  role?: UserRole | UserRoleName;
  avatarUrl?: string;
  data?: Record<string, unknown>;
}
export interface UpdateUserInput {
  name?: string;
  role?: UserRole | UserRoleName;
  avatarUrl?: string | null;
  data?: Record<string, unknown>;
}
interface UserRow {
  id: string; email: string; name: string | null; role: number; avatar_url: string | null;
  email_verified: number; data: string | null; created_at: string;
}

/** Core users are complete stored identities with a real existing profile. */
export class UserRepository {
  constructor(private database: CmsDatabase) {}

  private joinedUsers() {
    return this.database.db.selectFrom('_cms_auth_users as u')
      .innerJoin('_cms_auth_profiles as p', 'p.user_id', 'u.id');
  }

  private userQuery() {
    return this.joinedUsers()
      .select(['u.id', 'u.role', 'u.disabled', 'p.email', 'p.name', 'p.avatar_url',
        'p.email_verified', 'p.data', 'p.created_at', 'p.updated_at']);
  }

  async create(input: CreateUserInput): Promise<User> {
    const id = ulid();
    const row = {
      id,
      email: input.email.toLowerCase(),
      name: input.name ?? null,
      role: UserRepository.resolveRole(input.role ?? 10),
      avatar_url: input.avatarUrl ?? null,
      email_verified: 0,
      data: input.data ? JSON.stringify(input.data) : null
    };
    const profile = {
      user_id: id,
      email: row.email,
      name: row.name,
      avatar_url: row.avatar_url,
      email_verified: row.email_verified,
      data: row.data,
      // Source SQLite 008_auth defaults use (datetime('now')), with UTC seconds.
      created_at: sql<string>`datetime('now')`,
      updated_at: sql<string>`datetime('now')`
    };
    await this.database.atomicBatch([
      this.database.db.insertInto('_cms_auth_users').values({ id, role: row.role, disabled: 0 }).compile(),
      this.database.db.insertInto('_cms_auth_profiles').values(profile).compile()
    ]);
    const user = await this.findById(id);
    if (!user) throw new Error('Failed to create user');
    return user;
  }

  async findById(id: string): Promise<User | null> {
    const row = await this.userQuery().where('u.id', '=', id).executeTakeFirst();
    return row ? this.rowToUser(row) : null;
  }

  async findByIds(ids: string[]): Promise<User[]> {
    const unique = [...new Set(ids)].filter(id => id.length > 0);
    if (unique.length === 0) return [];
    const out: User[] = [];
    for (const batch of chunks(unique, SQL_BATCH_SIZE)) {
      const rows = await this.userQuery().where('u.id', 'in', batch).execute();
      for (const row of rows) out.push(this.rowToUser(row));
    }
    return out;
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.userQuery().where('p.email', '=', email.toLowerCase()).executeTakeFirst();
    return row ? this.rowToUser(row) : null;
  }

  async findMany(options: { role?: UserRole | UserRoleName; limit?: number; cursor?: string } = {}): Promise<Page<User>> {
    const limit = Math.min(Math.max(1, options.limit || 50), 100);
    let query = this.userQuery().orderBy('p.created_at', 'desc').orderBy('u.id', 'desc').limit(limit + 1);
    if (options.role !== undefined) query = query.where('u.role', '=', UserRepository.resolveRole(options.role));
    if (options.cursor) {
      const decoded = decodeCursor(options.cursor);
      query = query.where(eb => eb.or([
        eb('p.created_at', '<', decoded.orderValue),
        eb.and([eb('p.created_at', '=', decoded.orderValue), eb('u.id', '<', decoded.id)])
      ]));
    }
    const rows = await query.execute();
    const items = rows.slice(0, limit).map(row => this.rowToUser(row));
    const result: Page<User> = { items };
    if (rows.length > limit && items.length > 0) {
      const last = items.at(-1)!;
      result.nextCursor = encodeCursor(last.createdAt, last.id);
    }
    return result;
  }

  async update(id: string, input: UpdateUserInput): Promise<User | null> {
    const existing = await this.findById(id);
    if (!existing) return null;
    const profile: Updateable<CmsTables['_cms_auth_profiles']> = {};
    if (input.name !== undefined) profile.name = input.name;
    const role = input.role !== undefined ? UserRepository.resolveRole(input.role) : undefined;
    if (input.avatarUrl !== undefined) profile.avatar_url = input.avatarUrl;
    if (input.data !== undefined) profile.data = JSON.stringify(input.data);
    const statements = [];
    if (role !== undefined) statements.push(this.database.db.updateTable('_cms_auth_users')
      .set({ role }).where('id', '=', id).compile());
    if (Object.keys(profile).length > 0) statements.push(this.database.db.updateTable('_cms_auth_profiles')
      .set(profile).where('user_id', '=', id).compile());
    // Core Source update deliberately leaves updated_at unchanged.
    if (statements.length > 0) await this.database.atomicBatch(statements);
    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const query = this.database.db.deleteFrom('_cms_auth_users').where('id', '=', id)
      .where('id', 'in', this.database.db.selectFrom('_cms_auth_profiles').select('user_id'));
    const result = (await this.database.atomicBatch([query.compile()]))[0];
    return (result.numAffectedRows ?? 0n) > 0n;
  }

  async count(role?: UserRole | UserRoleName): Promise<number> {
    let query = this.joinedUsers()
      .select(eb => eb.fn.count('u.id').as('count'));
    if (role !== undefined) query = query.where('u.role', '=', UserRepository.resolveRole(role));
    const result = await query.executeTakeFirst();
    return Number(result?.count || 0);
  }

  async emailExists(email: string): Promise<boolean> {
    const row = await this.userQuery().where('p.email', '=', email.toLowerCase()).executeTakeFirst();
    return !!row;
  }

  private rowToUser(row: UserRow): User {
    return { id: row.id, email: row.email, name: row.name, role: UserRepository.toRole(row.role),
      avatarUrl: row.avatar_url, emailVerified: row.email_verified === 1,
      data: row.data ? JSON.parse(row.data) : null, createdAt: row.created_at };
  }

  private static readonly ROLE_NAME_TO_LEVEL: Record<UserRoleName, UserRole> = {
    subscriber: 10, contributor: 20, author: 30, editor: 40, admin: 50
  };
  private static readonly VALID_LEVELS = new Set<number>([10, 20, 30, 40, 50]);

  static resolveRole(role: UserRole | UserRoleName): UserRole {
    if (typeof role === 'string') {
      const level = UserRepository.ROLE_NAME_TO_LEVEL[role];
      if (level === undefined) throw new Error(`Invalid role name: ${role}`);
      return level;
    }
    if (!UserRepository.VALID_LEVELS.has(role)) throw new Error(`Invalid role level: ${role}`);
    return role;
  }

  private static toRole(level: number): UserRole {
    if (UserRepository.VALID_LEVELS.has(level)) return level as UserRole;
    return 10;
  }
}
