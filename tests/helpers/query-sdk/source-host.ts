// Existing actual canonical installation/registry fixture transport, shared by
// whole pinned query families. No rows, SQL, expectations or principals are faked.
export {
  setupTestDatabase,
  setupTestDatabaseWithCollections,
  teardownTestDatabase
} from '../full-search/source-host.ts';
