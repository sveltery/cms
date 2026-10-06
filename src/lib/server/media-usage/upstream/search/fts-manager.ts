// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// Finite type bridge to the existing canonical FTS manager. The actual query
// receiver is unchanged; no SQL/result rewriting or additional FTS writer.
import type { Kysely } from 'kysely';
import type { Database } from '../database/types.ts';
import { FTSManager as CanonicalFTSManager } from '../../../content-picker/fts-manager.ts';
export class FTSManager extends CanonicalFTSManager {
  constructor(db:Kysely<Database>) {
    super(db as unknown as ConstructorParameters<typeof CanonicalFTSManager>[0]);
  }
}
