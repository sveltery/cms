declare module '@sveltery/user-repository-under-test' {
  export const UserRepository: typeof import('../../../src/lib/server/users/repository.ts').UserRepository;
  export type UserRepository = import('../../../src/lib/server/users/repository.ts').UserRepository;
}
declare module '@sveltery/user-scopes-under-test' {
  export const clampScopes: typeof import('../../../src/lib/server/auth/permissions.ts').clampScopes;
}
