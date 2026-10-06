import type { AdminUser, AdminUserDetail } from '../server/accounts/repository.ts';

/** Public User99 remains the stored profile/role/detail projection owner. */
export type UserListItem = AdminUser & { oauthProviders?: string[] };
export type UserDetail = AdminUserDetail & { oauthProviders?: string[]; oauthAccounts?: { provider: string; createdAt: string }[] };
export interface UpdateUserInput { name?: string; email?: string; role?: number }
export interface InviteResult { success: true; message: string; inviteUrl?: string }
export interface UsersPageResult { items: UserListItem[]; nextCursor?: string; legacyCount?: number }
export interface UsersClient {
  fetchUsers(options?: { search?: string; role?: number; cursor?: string; limit?: number }): Promise<UsersPageResult>;
  fetchUser(id: string): Promise<UserDetail>;
  updateUser(id: string, input: UpdateUserInput): Promise<unknown>;
  disableUser(id: string): Promise<void>;
  enableUser(id: string): Promise<void>;
  sendRecoveryLink(id: string): Promise<void>;
  inviteUser(email: string, role?: number): Promise<InviteResult>;
}
