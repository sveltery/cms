import assert from 'node:assert/strict';
import type { CmsDatabase } from '../../../src/lib/server/database/contract.ts';
import { optionsMigration } from '../../../src/lib/server/database/options-migrations.ts';

const revisionNames = ['_cms_options_revision_insert','_cms_options_revision_update',
  '_cms_plugin_storage_revision_insert','_cms_plugin_storage_revision_update'];
type ObjectRow = {name:string;type:string;sql:string|null};
export async function assertCanonicalTriggerExtension(database:CmsDatabase,
  before:readonly ObjectRow[],after:readonly ObjectRow[]) {
  const original = (rows:readonly ObjectRow[]) => rows.filter(row => row.type==='trigger' && !revisionNames.includes(row.name));
  // Retain every original operator name/type/SQL assertion, independent of
  // the genuinely added four owned Source077 storage revision triggers.
  assert.deepEqual(original(after),original(before));
  const expected = await optionsMigration.expectedTriggers(database);
  assert.deepEqual(expected.map(row=>row.name),revisionNames);
  const shape = ({name,type,sql}:ObjectRow) => ({name,type,sql});
  const order = (a:ObjectRow,b:ObjectRow) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
  assert.deepEqual(after.filter(row=>row.type==='trigger').map(shape),
    [...original(before),...expected].map(shape).sort(order));
}
