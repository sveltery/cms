// Test-first baseline: the whole unchanged pinned Source repository executes on
// actual public Native storage. Missing logical users storage is a product gap;
// it is not repaired, mocked or mapped onto the incomplete auth-only table here.
import { UserRepository as PinnedUserRepository } from '../../../parity/emdash/users/source/packages/core/src/database/repositories/user.ts';
import type { CmsDatabase } from '../../../src/lib/server/database/contract.ts';
export class UserRepository extends PinnedUserRepository {
  constructor(database: CmsDatabase) { super(database.db as unknown as ConstructorParameters<typeof PinnedUserRepository>[0]); }
}
