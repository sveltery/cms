/** Classify the measured D1 SQLite envelope without replacing the original error. */
export function sqliteErrorMessage(cause: unknown): string | undefined {
  if (!(cause instanceof Error)) return undefined;
  // Local D1 adds SQL offsets for DDL errors and extended constraint names.
  // Unrecognized envelopes remain unmatched by callers' exact race checks.
  return /^D1_ERROR: (.+?)(?: at offset \d+)?: SQLITE_(?:ERROR|CONSTRAINT(?: \(extended: SQLITE_CONSTRAINT_[A-Z]+\))?)$/.exec(cause.message)?.[1] ?? cause.message;
}
