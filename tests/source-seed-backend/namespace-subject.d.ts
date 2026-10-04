// Original Native test subject. The baseline and finite candidate share this factory contract.
declare module 'seed-namespace-subject' {
  export const seedAtomicBatch: typeof import('../helpers/source-seed-backend/namespace-baseline.ts').seedAtomicBatch;
  export const seedSourceDatabase: typeof import('../../src/lib/server/canonical-storage/namespace.ts').canonicalSourceDatabase;
}
