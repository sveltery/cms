import {expect,it} from 'vitest';
import {sql,type Kysely,type KyselyPlugin} from 'kysely';
import {schemaAdminStorage} from '../helpers/schema-admin-storage.ts';
import {migrateCms} from '../../src/lib/server/database/migrations.ts';
import {seedSourceDatabase,seedNativeBylines} from '../../src/lib/server/seed/namespace.ts';
import {MediaRepository,MediaUsageRepository,TaxonomyRepository,RelationRepository} from '../../src/lib/server/seed/d1-providers.ts';

async function fixture(){
 const storage=await schemaAdminStorage('D1');
 try{
  await migrateCms(storage.database);
  const guarded=seedSourceDatabase(storage.database);
  // Inspect the actual repository's private query handle only in this fixture.
  const db=(seedNativeBylines(guarded) as unknown as {db:Kysely<any>}).db;
  return{storage,db,guarded};
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
  expect((await sql`SELECT name FROM _cms_options WHERE name='not-written'`.execute(f.storage.database.db)).rows).toEqual([]);
  await expect(f.db.updateTable('_cms_options').set({value:'not-written'}).execute()).rejects.toThrow('executes only real reads');
 }finally{await f.storage.close();}
},30000);
it('observes actual media writes, media reads and usage reads on the same owner',async()=>{
 const f=await fixture();try{
  const queries:unknown[]=[],results:unknown[]=[];
  const db=f.guarded.withPlugin({transformQuery({node,queryId}){queries.push(queryId);return node;},async transformResult({result,queryId}){results.push(queryId);return result;}});
  const media=new MediaRepository(db);
  const item=await media.create({filename:'observed.png',mimeType:'image/png',storageKey:'observed.png'});
  expect((await media.findById(item.id))?.id).toBe(item.id);
  expect(await new MediaUsageRepository(db).findSource('absent-observed-source')).toBeNull();
  expect(queries).toHaveLength(3);expect(results).toEqual(queries);
  expect((await sql`SELECT id FROM _cms_media WHERE id=${item.id}`.execute(f.storage.database.db)).rows).toEqual([{id:item.id}]);
 }finally{await f.storage.close();}
},30000);
it('observes actual canonical taxonomy and relation writes and their real receipts',async()=>{
 const f=await fixture();try{
  const queries:{kind:string,id:unknown}[]=[],results:unknown[]=[];
  const db=f.guarded.withPlugin({transformQuery({node,queryId}){queries.push({kind:node.kind,id:queryId});return node;},async transformResult({result,queryId}){results.push(queryId);return result;}});
  const term=await new TaxonomyRepository(db).create({name:'tag',slug:'observed-term',label:'Observed Term'});
  const relation=await new RelationRepository(db).create({slug:'observed_relation',parentCollection:'posts',childCollection:'pages',parentLabel:'Posts',childLabel:'Pages'});
  expect(queries.filter(query=>query.kind==='InsertQueryNode')).toHaveLength(2);
  expect(results).toEqual(queries.map(query=>query.id));
  expect((await sql`SELECT id FROM _cms_taxonomies WHERE id=${term.id}`.execute(f.storage.database.db)).rows).toEqual([{id:term.id}]);
  expect((await sql`SELECT id FROM _cms_relations WHERE id=${relation.id}`.execute(f.storage.database.db)).rows).toEqual([{id:relation.id}]);
 }finally{await f.storage.close();}
},30000);
