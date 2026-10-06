// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// Finite composition on the existing Seed owner; no additional projection writer.
import type { Kysely } from 'kysely';
import { blockDatabaseHost } from '../blocks/upstream/host.ts';
import type { Database } from '../blocks/upstream/database/types.ts';
import type { Database as SeedDatabase } from '../seed/upstream/database/types.ts';
import { registeredSeedDatabaseOwner,seedSourceDatabase,seedNativeRefreshContentMediaUsageForWorkBatch,
  seedNativeRefreshContentMediaUsageAfterWrite,seedNativeDeleteContentMediaUsage } from '../seed/namespace.ts';
import { loadContentMediaUsageFields } from '../seed/upstream/media/usage/content-fields.ts';
import { loadContentMediaUsageSnapshots } from '../seed/upstream/media/usage/content-snapshots.ts';

type Arguments<F extends (...args:any[])=>unknown> = Parameters<F> extends [unknown,...infer A]?A:never;
/** Only named existing read/projection operations receive this private view. */
export class NativeMediaUsageContentDependencies {
  readonly #view:Kysely<SeedDatabase>;
  constructor(db:Kysely<Database>) {
    const registered=registeredSeedDatabaseOwner(db);
    const owner=registered??blockDatabaseHost(db);
    if(!owner)throw new Error('Media usage dependencies require their actual registered CMS owner');
    this.#view=registered?db as unknown as Kysely<SeedDatabase>:seedSourceDatabase(owner);
  }
  fields(...args:Arguments<typeof loadContentMediaUsageFields>) {
    return loadContentMediaUsageFields(this.#view,...args);
  }
  snapshots(...args:Arguments<typeof loadContentMediaUsageSnapshots>) {
    return loadContentMediaUsageSnapshots(this.#view,...args);
  }
  refreshWork(...args:Arguments<typeof seedNativeRefreshContentMediaUsageForWorkBatch>) {
    return seedNativeRefreshContentMediaUsageForWorkBatch(this.#view,...args);
  }
  refreshAfterWrite(...args:Arguments<typeof seedNativeRefreshContentMediaUsageAfterWrite>) {
    return seedNativeRefreshContentMediaUsageAfterWrite(this.#view,...args);
  }
  deleteContent(...args:Arguments<typeof seedNativeDeleteContentMediaUsage>) {
    return seedNativeDeleteContentMediaUsage(this.#view,...args);
  }
}
