// Unregistered owned adapters. Shared registration waits for actual public6–8.
// Source authorities and public feature factories remain byte-identical.
import type { CompiledQuery } from 'kysely';
import type { CmsDatabase } from '../contract.ts';
import { migrationObjects, type CmsMigrationProvider, type MigrationObject } from '../migration-provider.ts';
import { menuSchemaStatements } from '../../menus/migrations.ts';
import { sectionsWidgetsMigration } from '../../sections-widgets/schema.ts';
import { commentSchemaStatements } from '../../comments/migrations.ts';
import { commentRuntimeSchemaStatements } from '../../comments/runtime-migrations.ts';
import { directedRelationStorageObjects, mediaAttributionStorageDescriptor, type FeatureStorageObject } from './descriptors.ts';
import { planPrimaryBylineIndexes, expectedPrimaryBylineIndexes } from './byline-index-plan.ts';
import { planLegacyReferenceConversion } from './legacy-reference-plan.ts';
import { redirectStorageDescriptor } from './redirect-storage.ts';

export interface PreparedFeatureStoragePlan {
  /** Hoisted together before ANY ordinary canonical startup write. */
  readonly guards: readonly CompiledQuery[];
  readonly statements: readonly CompiledQuery[];
}
export type FeatureStorageTrigger = FeatureStorageObject & { readonly type: 'trigger' };
/** Structural proposal only; no shared provider contract is changed here. */
export interface UnregisteredFeatureMigration extends CmsMigrationProvider {
  prepare(database: CmsDatabase): Promise<PreparedFeatureStoragePlan>;
  expectedTriggers(database: CmsDatabase, installedVersion?: number): Promise<readonly FeatureStorageTrigger[]>;
}
function ordinaryObjects(objects: readonly FeatureStorageObject[]): MigrationObject[] {
  return objects.filter((object): object is FeatureStorageObject & { type: 'table' | 'index' } => object.type !== 'trigger');
}
function triggerObjects(objects: readonly FeatureStorageObject[]): FeatureStorageTrigger[] {
  return objects.filter((object): object is FeatureStorageTrigger => object.type === 'trigger');
}
async function guardedStatements(provider: UnregisteredFeatureMigration, database: CmsDatabase): Promise<readonly CompiledQuery[]> {
  const plan = await provider.prepare(database);
  return [...plan.guards, ...plan.statements];
}
function staticProvider(version: number, name: string, statements: (database: CmsDatabase) => Promise<readonly CompiledQuery[]>,
  objects: (database: CmsDatabase) => readonly FeatureStorageObject[] | Promise<readonly FeatureStorageObject[]>): UnregisteredFeatureMigration {
  return { version, name,
    async prepare(database) { return { guards: [], statements: await statements(database) }; },
    async statements(database) { return guardedStatements(this, database); },
    async expectedObjects(database) { return ordinaryObjects(await objects(database)); },
    async expectedTriggers(database) { return triggerObjects(await objects(database)); }
  };
}

export const mediaAttributionMigration: UnregisteredFeatureMigration = {
  version: 9, name: mediaAttributionStorageDescriptor.name,
  async prepare(database) {
    const indexes = await planPrimaryBylineIndexes(database);
    return { guards: indexes.guards,
      statements: [...await mediaAttributionStorageDescriptor.statements(database), ...indexes.statements] };
  },
  async statements(database) { return guardedStatements(this, database); },
  async expectedObjects(database, installedVersion = 0) {
    return [...ordinaryObjects(mediaAttributionStorageDescriptor.expectedObjects()),
      ...await expectedPrimaryBylineIndexes(database, installedVersion)];
  },
  async expectedTriggers() { return triggerObjects(mediaAttributionStorageDescriptor.expectedObjects()); }
};
export const directedRelationsMigration: UnregisteredFeatureMigration = {
  version: 10, name: 'directed-relations-storage-and-legacy-references',
  async prepare(database) {
    const legacy = await planLegacyReferenceConversion(database);
    return { guards: legacy.guards, statements: [...directedRelationStorageObjects.statements(database), ...legacy.statements] };
  },
  async statements(database) { return guardedStatements(this, database); },
  async expectedObjects() { return ordinaryObjects(directedRelationStorageObjects.expectedObjects()); },
  async expectedTriggers() { return []; }
};
export const menusMigration = staticProvider(11, 'menus-storage', async database => menuSchemaStatements(database),
  database => migrationObjects(menuSchemaStatements(database)));
const sectionsWidgets = sectionsWidgetsMigration(12);
export const sectionsWidgetsStorageMigration = staticProvider(12, sectionsWidgets.name,
  database => sectionsWidgets.statements(database), database => sectionsWidgets.expectedObjects(database));

function commentsStatements(database: CmsDatabase): CompiledQuery[] {
  return [...commentSchemaStatements(database.db), ...commentRuntimeSchemaStatements(database.db)];
}
export const commentsMigration = staticProvider(13, 'comments-and-native-runtime-storage', async database => commentsStatements(database),
  database => commentsStatements(database).flatMap(statement => {
    const match = /^CREATE (?:UNIQUE )?(TABLE|INDEX|TRIGGER) (\w+)/.exec(statement.sql)!;
    return [{ name: match[2], type: match[1].toLowerCase() as FeatureStorageObject['type'], sql: statement.sql }];
  }));
export const redirectsMigration = staticProvider(14, redirectStorageDescriptor.name,
  database => redirectStorageDescriptor.statements(database), () => redirectStorageDescriptor.expectedObjects());
