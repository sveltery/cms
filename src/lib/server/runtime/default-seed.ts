// Native runtime transport of complete pinned EmDashRuntime1692–1747.
// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
import type { CmsDatabase } from '../database/contract.ts';
import { identityOptions } from '../auth/identity-store.ts';
import { createInitLock, type InitLock } from '../redirects/init-lock.ts';
import { initializeDefaultSeed } from '../seed/index.ts';
import { seedSourceDatabase } from '../seed/namespace.ts';

interface SeedHolder {
  lock: InitLock;
  done: Set<string>;
  d1Keys: WeakMap<object, string>;
  nextD1Key: number;
}
const HOLDER_KEY = Symbol.for('sveltery:default-seed-state');
// Source's 10,000ms concurrent migrator wait plus 20,000ms initialization headroom.
const DEFAULT_SEED_DEADLINE_MS = 30_000;
function seedHolder(): SeedHolder {
  const globals = globalThis as typeof globalThis & { [HOLDER_KEY]?: SeedHolder };
  return globals[HOLDER_KEY] ??= { lock: createInitLock(), done: new Set(), d1Keys: new WeakMap(), nextD1Key: 0 };
}

/** Only the real configured singleton enters this producer. Request-scoped D1
 * databases stay under the existing request owner and never initialize a seed. */
export async function initializeConfiguredDefaultSeed(database: CmsDatabase,
  configured: { kind: 'sqlite'; path: string; keepAlive?: (task: Promise<void>) => void } |
    { kind: 'd1'; binding: object; keepAlive?: (task: Promise<void>) => void }) {
  // Account completion remains the existing enrollment authority. Read its
  // actual receipt; do not mirror account flags/state into canonical options.
  const accountComplete = await identityOptions(database).get('emdash:setup_complete');
  if (accountComplete === true || accountComplete === 'true') return;
  const holder = seedHolder();
  let databaseKey: string;
  if (configured.kind === 'sqlite') databaseKey = `sqlite:${configured.path}`;
  else {
    let key = holder.d1Keys.get(configured.binding);
    if (!key) { key = `d1:${++holder.nextD1Key}`; holder.d1Keys.set(configured.binding, key); }
    databaseKey = key;
  }
  return initializeDefaultSeed(seedSourceDatabase(database), {
    databaseKey, holder, deadlineMs: DEFAULT_SEED_DEADLINE_MS,
    anchor: configured.keepAlive, ownsConfiguredDatabase: true
  });
}
