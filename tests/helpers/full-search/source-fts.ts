// Test transport: the SAME Native producer creates real pinned Source FTS names.
// No raw SQL, sqlite_master/shadow names, literals, assertions or rows are rewritten.
import { FTSManager as NativeFTSManager } from '../../../src/lib/server/content-picker/fts-manager.ts';
export class FTSManager extends NativeFTSManager {
  override getFtsTableName(slug: string): string {
    super.getFtsTableName(slug); // Preserve the real producer's identifier validation.
    return `_emdash_fts_${slug}`;
  }
}
