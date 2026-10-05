/** The public schema registry alone cannot perform coupled reference cleanup. */
export class SchemaDeletionUnavailable extends Error {
  readonly code = 'REFERENCE_CLEANUP_UNAVAILABLE';
  readonly status = 503;
  constructor() { super('Deletion is unavailable until relationships and content references can be cleaned up'); }
}
export function requireSchemaDeletionReady(): never { throw new SchemaDeletionUnavailable(); }
