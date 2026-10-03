// Original product-composition requirements; zero copied-source callback credit.
import test from 'node:test';
import assert from 'node:assert/strict';
import {sql} from 'kysely';
import {schemaAdminRemotes} from '../helpers/schema-admin-remotes.ts';
import {identityOptions} from '../../src/lib/server/auth/identity-store.ts';
import {OptionsRepository} from '../../src/lib/server/settings/options.ts';
import {useEmptySetupAuthority} from '../helpers/setup-first-run-authority.ts';
for(const target of ['Node','D1'] as const)test(`${target}: default site step persists actual collections, taxonomy structures and live search indexes before admin setup`,async()=>{
 const h=await schemaAdminRemotes(target,true,{configureRequest(event){event.locals.cmsRuntime={publicOrigin:h.origin,basePath:'',rpName:'Test'};}});
 try{
  await useEmptySetupAuthority(h.database);
  const response=await h.request('/api/setup',null,{method:'POST',headers:{origin:h.origin,'content-type':'application/json'},body:JSON.stringify({title:'Working Site',tagline:'Real seed',includeContent:false})});
  assert.equal(response.status,200);const body=await response.json();assert.equal(body.data.seedComplete,true);
  assert.equal(body.data.result.collections.created,2);assert.equal(body.data.result.fields.created,6);
  // Untouched built-in labels/structures update in place; source never counts
  // those existing rows as creates. The native private updated receipt is omitted.
  assert.deepEqual(body.data.result.taxonomies,{created:0,skipped:0,terms:0});
  const collections=await h.registry.listCollections();assert.deepEqual(collections.map(value=>value.slug).sort(),['pages','posts']);
  for(const collection of collections){assert.deepEqual(collection.supports,['drafts','revisions','search']);assert.equal(collection.source,'seed');}
  const taxonomies=(await sql<{id:string;name:string;hierarchical:number;collections:string}>`SELECT id,name,hierarchical,collections FROM _cms_taxonomy_defs ORDER BY name`.execute(h.database.db)).rows;
  assert.deepEqual(taxonomies.map(row=>({id:row.id,name:row.name,hierarchical:row.hierarchical,collections:JSON.parse(row.collections)})),[{id:'taxdef_category',name:'category',hierarchical:1,collections:['posts']},{id:'taxdef_tag',name:'tag',hierarchical:0,collections:['posts']}]);
  const search=(await sql<{slug:string;search_config:string}>`SELECT slug,search_config FROM _cms_collections ORDER BY slug`.execute(h.database.db)).rows;
  for(const row of search){const config=JSON.parse(row.search_config);assert.equal(config.enabled,true);assert.equal(config.tokenize,undefined);const ddl=(await sql<{sql:string}>`SELECT sql FROM sqlite_master WHERE type='table' AND name=${'_cms_fts_'+row.slug}`.execute(h.database.db)).rows[0];assert.match(ddl.sql,/porter unicode61/);}
  const options=new OptionsRepository(h.database.db as any);assert.equal(await options.get('site:title'),'Working Site');assert.equal(await options.get('site:tagline'),'Real seed');assert.equal(await options.get('emdash:site_url'),h.origin);
  assert.deepEqual(await identityOptions(h.database).get('emdash:setup_state'),{step:'site_complete',title:'Working Site',tagline:'Real seed'});
  // Real FTS triggers index newly persisted source-shaped content rows.
  await sql`INSERT INTO ec_posts(id,slug,status,title,created_at,updated_at) VALUES('seed_search','seed-search','published','Seeding Cosmos',${new Date().toISOString()},${new Date().toISOString()})`.execute(h.database.db);
  assert.equal((await sql<{n:number}>`SELECT COUNT(*) AS n FROM _cms_fts_posts WHERE _cms_fts_posts MATCH 'cosmos'`.execute(h.database.db)).rows[0].n,1);
 }finally{await h.close();}
});
