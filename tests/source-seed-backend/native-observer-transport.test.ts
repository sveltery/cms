import {expect,it} from 'vitest';
import {sql,type Kysely,type KyselyPlugin} from 'kysely';
import {schemaAdminStorage} from '../helpers/schema-admin-storage.ts';
import {migrateCms} from '../../src/lib/server/database/migrations.ts';
import {seedSourceDatabase,seedNativeBylines} from '../../src/lib/server/seed/namespace.ts';

async function fixture(){
 const storage=await schemaAdminStorage('D1');
 try{
  await migrateCms(storage.database);
  const guarded=seedSourceDatabase(storage.database);
  // Inspect the actual repository's private query handle only in this fixture.
  const db=(seedNativeBylines(guarded) as unknown as {db:Kysely<any>}).db;
  return{storage,db};
 }catch(error){await storage.close();throw error;}
}
it('retains a query-builder observer on the actual read and its real result',async()=>{
 const f=await fixture();try{
  const queries:unknown[]=[],results:unknown[]=[];
  const plugin:KyselyPlugin={transformQuery({node,queryId}){queries.push(queryId);return node;},async transformResult({result,queryId}){results.push(queryId);return result;}};
  const row=await f.db.selectFrom('_cms_options').select('key').where('key','=','absent-observer-key').withPlugin(plugin).executeTakeFirst();
  expect(row).toBeUndefined();expect(queries).toHaveLength(1);expect(results).toEqual(queries);
 }finally{await f.storage.close();}
},30000);
it('refuses mutations nested in a read CTE before executing the actual adapter',async()=>{
 const f=await fixture();try{
  await expect(f.db.with('changed',db=>db.insertInto('_cms_options').values({key:'not-written',value:'not-written',autoload:0}).returning('key')).selectFrom('changed').selectAll().execute()).rejects.toThrow('executes only real reads');
  expect((await sql`SELECT key FROM _cms_options WHERE key='not-written'`.execute(f.storage.database.db)).rows).toEqual([]);
  await expect(f.db.updateTable('_cms_options').set({value:'not-written'}).execute()).rejects.toThrow('executes only real reads');
 }finally{await f.storage.close();}
},30000);
