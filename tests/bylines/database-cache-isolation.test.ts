// Original Native cache-owner regressions. Real separate canonical databases;
// no copied Source assertion credit, middleware, session or race probe.
import { beforeEach, describe, expect, it } from 'vitest';
import { openSqlite } from '../../src/lib/server/database/sqlite.ts';
import { openD1 } from '../../src/lib/server/database/d1.ts';
import { migrateCms } from '../../src/lib/server/database/migrations.ts';
import { BylineSchemaRegistry } from '../../src/lib/server/bylines/schema.ts';
import { getBylineFieldDefs, resetBylineFieldDefsCacheForTests } from '../../src/lib/server/bylines/field-defs-cache.ts';
import { registerBylineDatabase } from '../../src/lib/server/bylines/storage.ts';
import { runWithContext } from '../../src/lib/server/menus/context.ts';
import { asyncD1Storage } from '../helpers/async-d1-storage.ts';

beforeEach(() => resetBylineFieldDefsCacheForTests());
describe('Byline field cache belongs to the actual configured database', () => {
 it('keeps different SQLite definitions and IDs distinct at the same even version', async () => {
  const first = openSqlite(':memory:');
  const second = openSqlite(':memory:');
  try {
   await migrateCms(first); await migrateCms(second);
   const firstRegistry = new BylineSchemaRegistry(first);
   const secondRegistry = new BylineSchemaRegistry(second);
   const firstField = await firstRegistry.createField({slug:'first_job',label:'First job',type:'string'});
   const secondField = await secondRegistry.createField({slug:'second_job',label:'Second job',type:'string'});
   expect(await firstRegistry.getVersion()).toBe(2);
   expect(await secondRegistry.getVersion()).toBe(2);
   expect((await getBylineFieldDefs(registerBylineDatabase(first))).map(field=>[field.id,field.slug])).toEqual([[firstField.id,'first_job']]);
   expect((await getBylineFieldDefs(registerBylineDatabase(second))).map(field=>[field.id,field.slug])).toEqual([[secondField.id,'second_job']]);
  } finally { await first.close(); await second.close(); }
 });
 it('keeps different real D1 bindings distinct within the same request at the same even version', async () => {
  const firstStorage = await asyncD1Storage();
  const secondStorage = await asyncD1Storage();
  const first = openD1(firstStorage.binding);
  const second = openD1(secondStorage.binding);
  try {
   await migrateCms(first); await migrateCms(second);
   const firstRegistry = new BylineSchemaRegistry(first);
   const secondRegistry = new BylineSchemaRegistry(second);
   const firstField = await firstRegistry.createField({slug:'first_job',label:'First job',type:'string'});
   const secondField = await secondRegistry.createField({slug:'second_job',label:'Second job',type:'string'});
   expect(await firstRegistry.getVersion()).toBe(2);
   expect(await secondRegistry.getVersion()).toBe(2);
   await runWithContext({editMode:false},async () => {
    expect((await getBylineFieldDefs(registerBylineDatabase(first))).map(field=>[field.id,field.slug])).toEqual([[firstField.id,'first_job']]);
    expect((await getBylineFieldDefs(registerBylineDatabase(second))).map(field=>[field.id,field.slug])).toEqual([[secondField.id,'second_job']]);
   });
  } finally { await first.close(); await second.close(); await firstStorage.runtime.dispose(); await secondStorage.runtime.dispose(); }
 },90000);
});
