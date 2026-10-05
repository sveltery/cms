import { Kysely as NativeKysely, type KyselyConfig } from 'kysely';
import { relationReferencePlugin } from './source-db.ts';
export * from 'kysely';

// The fixture installs actual Source-named tables. Only query identifier nodes
// are transported. The database logger receives the actual executed SQL.
export class Kysely<DB> extends NativeKysely<DB> {
  constructor(config: KyselyConfig) {
    super({ ...config, plugins: [...(config.plugins ?? []), relationReferencePlugin] });
  }
}
