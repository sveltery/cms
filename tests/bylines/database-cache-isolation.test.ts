// Original Native cache-owner regressions. Real separate canonical databases;
// no copied Source assertion credit, middleware, session or race probe.
import { beforeEach, describe, expect, it } from 'vitest';
import { sql } from 'kysely';
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
 it('shares a holder for registered raw and logical views of the same actual owner', async () => {
  const database = openSqlite(':memory:');
  try {
   await migrateCms(database);
   await new BylineSchemaRegistry(database).createField({slug:'job_title',label:'Job title',type:'string'});
   const logical = registerBylineDatabase(database);
   await runWithContext({editMode:false},async () => {
    const first = await getBylineFieldDefs(logical);
    expect(await getBylineFieldDefs(database.db as any)).toBe(first);
   });
  } finally { await database.close(); }
 });
 it("reads each owner's own dirty version before consulting its holder within one request", async () => {
  const first = openSqlite(':memory:');
  const second = openSqlite(':memory:');
  try {
   await migrateCms(first); await migrateCms(second);
   const firstDb = registerBylineDatabase(first);
   const secondDb = registerBylineDatabase(second);
   expect(await getBylineFieldDefs(secondDb)).toEqual([]);
   await sql`INSERT INTO _cms_options(name,value) VALUES ('byline_fields_version','1') ON CONFLICT(name) DO UPDATE SET value='1'`.execute(second.db);
   await sql`INSERT INTO _cms_byline_fields(id,slug,label,type,required,translatable,sort_order) VALUES ('pending-field','pending_field','Pending field','string',0,1,0)`.execute(second.db);
   await runWithContext({editMode:false},async () => {
    expect(await getBylineFieldDefs(firstDb)).toEqual([]);
    expect((await getBylineFieldDefs(secondDb)).map(field=>field.slug)).toEqual(['pending_field']);
   });
  } finally { await first.close(); await second.close(); }
 });
 it('bypasses both cache tiers when a read-only derived view has no registered owner identity', async () => {
  const database = openSqlite(':memory:');
  try {
   await migrateCms(database);
   const logical = registerBylineDatabase(database);
   const readOnlyView = logical.withPlugin({transformQuery:({node})=>node,transformResult:async ({result})=>result});
   await runWithContext({editMode:false},async () => {
    expect(await getBylineFieldDefs(readOnlyView)).toEqual([]);
    await sql`INSERT INTO _cms_byline_fields(id,slug,label,type,required,translatable,sort_order) VALUES ('later-field','later_field','Later field','string',0,1,0)`.execute(database.db);
    expect((await getBylineFieldDefs(readOnlyView)).map(field=>field.slug)).toEqual(['later_field']);
   });
  } finally { await database.close(); }
 });

});
