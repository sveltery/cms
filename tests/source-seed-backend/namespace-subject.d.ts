// Original Native test subject. The baseline and finite candidate share this factory contract.
declare module 'seed-namespace-subject' {
  export const seedSourceDatabase: typeof import('../../src/lib/server/canonical-storage/namespace.ts').canonicalSourceDatabase;
}
