// Test-only subject alias: the baseline and owned Source port share this API.
declare module 'seed-datetime-subject' {
  export const ContentDatetimeNormalizer: typeof import('../../src/lib/server/database/lifecycle/upstream/database/content-datetime.ts').ContentDatetimeNormalizer;
}
