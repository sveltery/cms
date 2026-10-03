import type { Kysely } from 'kysely';
import { up as base } from './029_redirects.ts';
import { up as bounded404 } from './035_bounded_404_log.ts';
import { up as guards } from './081_redirect_write_guards.ts';
import { up as enableGuard } from './090_redirect_enable_loop_guard.ts';
import { up as artifacts } from './091_redirect_artifacts.ts';

/** Statement provider for the future contiguous canonical redirect migration; not registered or invoked by requests. */
export async function installRedirectTables(db: Kysely<unknown>): Promise<void> {
  await base(db);
  await bounded404(db);
  await guards(db);
  await enableGuard(db);
  await artifacts(db);
}
