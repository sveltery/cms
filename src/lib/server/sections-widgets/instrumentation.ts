/** Source-shaped optional recorder types; this feature installs no query logger. */
export interface QueryRecorder {
  events: { sql: string; params: readonly unknown[]; durationMs: number; route: string; method: string; phase: string }[];
  route: string; method: string; phase: string; flushed?: boolean; deferredFlush?: boolean;
}
