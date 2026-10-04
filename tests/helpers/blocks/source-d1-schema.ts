// Finite test-only Source catalogue constructor/API adaptation. No global SQL rewriting.
import type { Kysely } from 'kysely';
import type { Database } from '../../../src/lib/server/blocks/upstream/database/types.ts';
import * as original from '../../../parity/emdash/block-registry-source/executable/packages/core/tests/workerd/d1-schema.ts';
const names: Record<string,string> = {
  _emdash_collections:'_cms_collections',_emdash_fields:'_cms_fields',
  _emdash_block_types:'_cms_block_types',_emdash_block_type_versions:'_cms_block_type_versions'
};
const logical=Object.fromEntries(Object.entries(names).map(([source,physical])=>[physical,source]));
const physicalName=(name:string)=>Object.hasOwn(names,name)?names[name]:name;
// Whole original reset uses actual storage catalogue values for dependency/drop order.
export const resetD1Schema=original.resetD1Schema;
export async function listTables(db:Kysely<Database>) {
  return (await original.listTables(db)).map(name=>Object.hasOwn(logical,name)?logical[name]:name);
}
export async function listIndexes(db:Kysely<Database>,table:string) {
  return original.listIndexes(db,physicalName(table));
}
export async function listColumns(db:Kysely<Database>,table:string) {
  return original.listColumns(db,physicalName(table));
}
// This original legacy helper remains unqualified: its raw Source INSERT and
// older collection shape require the complete Source legacy metadata provider.
export const seedLegacyCollection=original.seedLegacyCollection;
