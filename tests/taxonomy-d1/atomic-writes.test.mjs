// Original Native D1 requirements. Dedicated ordinary SQL only: no identity, HTTP or race probes.
import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'vitest';
import { sql } from 'kysely';
import { localD1 } from '../helpers/local-d1-fixture.ts';
import { migrateCms } from '../../src/lib/server/database/migrations.ts';
import { SchemaRegistry } from '../../src/lib/server/database/registry.ts';
import { canonicalSourceDatabase } from '../../src/lib/server/canonical-storage/namespace.ts';
import { TaxonomyRepository } from '../../src/lib/server/taxonomies/repository.ts';

let fixture, storage, db, repo;
beforeEach(async () => {
  fixture = await localD1(); storage = fixture.database;
  await migrateCms(storage);
  const registry = new SchemaRegistry(storage);
  await registry.createCollection({slug:'post', label:'Posts'});
  await registry.createField('post', {slug:'title',label:'Title',type:'string'});
  db = canonicalSourceDatabase(storage); repo = new TaxonomyRepository(db);
});
afterEach(async () => { await storage?.close(); await fixture?.runtime.dispose(); });
const rows = async statement => (await statement.execute(storage.db)).rows;
async function create(input) {
  let term;
  await assert.doesNotReject(async () => { term = await repo.create(input); }, 'real D1 taxonomy writes must use the atomic provider');
  return term;
}
async function handlers() {
  let api; await assert.doesNotReject(async () => { api = await import('../../src/lib/server/taxonomies/handlers.ts'); }); return api;
}
function successful(result) { assert.equal(result.success,true,JSON.stringify(result)); return result.data; }

test('D1: one concept has locale-specific labels and one actual group', async () => {
  const en = await create({name:'tag',slug:'news',label:'News',locale:'en'});
  const fr = await create({name:'tag',slug:'nouvelles',label:'Nouvelles',locale:'fr',translationOf:en.id});
  assert.equal(fr.translationGroup,en.translationGroup);
  assert.deepEqual((await rows(sql`SELECT locale,label,translation_group FROM _cms_taxonomies WHERE name='tag' ORDER BY locale`))
    .map(row=>[row.locale,row.label,row.translation_group]), [['en','News',en.id],['fr','Nouvelles',en.id]]);
});

test('D1: failed group move rolls back the just-inserted translation', async () => {
  const root = await create({name:'category',slug:'parent',label:'Parent'});
  const other = await create({name:'category',slug:'other',label:'Other'});
  const child = await create({name:'category',slug:'child',label:'Child',parentId:root.id});
  await sql`CREATE TRIGGER taxonomy_fixture_fail_move BEFORE UPDATE OF parent_id ON _cms_taxonomies
    WHEN NEW.parent_id = ${sql.lit(other.id)} BEGIN SELECT RAISE(ABORT, 'taxonomy fixture move failure'); END`.execute(storage.db);
  await assert.rejects(repo.create({name:'category',slug:'enfant',label:'Enfant',locale:'fr',translationOf:child.id,parentId:other.id}), /taxonomy fixture move failure/);
  assert.deepEqual((await rows(sql`SELECT locale,parent_id FROM _cms_taxonomies WHERE translation_group=${child.id}`))
    .map(row=>[row.locale,row.parent_id]), [['en',root.id]]);
});

test('D1: a definition creation failure leaves neither its locale nor its structure group', async () => {
  const api = await handlers();
  await sql`CREATE TRIGGER taxonomy_fixture_fail_structure BEFORE UPDATE OF translation_group ON _cms_taxonomy_defs
    WHEN NEW.name = 'genre' BEGIN SELECT RAISE(ABORT, 'taxonomy fixture structure failure'); END`.execute(storage.db);
  const result = await api.handleTaxonomyCreate(db,{name:'genre',label:'Genres',collections:['post']});
  assert.equal(result.success,false);
  assert.equal(result.error.code,'TAXONOMY_CREATE_ERROR');
  assert.deepEqual(await rows(sql`SELECT id FROM _cms_taxonomy_defs WHERE name='genre'`), []);
  assert.deepEqual(await rows(sql`SELECT id FROM _cms_taxonomy_def_groups WHERE name='genre'`), []);
});

test('D1: editing one locale changes shared structure and preserves other labels', async () => {
  const api = await handlers();
  const en = successful(await api.handleTaxonomyCreate(db,{name:'genre',label:'Genres',collections:['post']})).taxonomy;
  successful(await api.handleTaxonomyCreate(db,{name:'genre',label:'Genres français',locale:'fr',translationOf:en.id}));
  successful(await api.handleTaxonomyUpdate(db,'genre',{locale:'fr',label:'Types français',hierarchical:true}));
  assert.deepEqual((await rows(sql`SELECT locale,label,hierarchical,collections FROM _cms_taxonomy_defs WHERE name='genre' ORDER BY locale`))
    .map(row=>[row.locale,row.label,row.hierarchical,JSON.parse(row.collections)]), [['en','Genres',1,['post']],['fr','Types français',1,['post']]]);
});

test('D1: a later reorder chunk failure rolls back all earlier chunks', async () => {
  // Real rows/real trigger; 66 groups force three <=96-parameter Source chunks.
  for(let index=0;index<66;index++) {
    const id='term-'+String(index).padStart(3,'0');
    await storage.db.insertInto('_cms_taxonomies').values({id,name:'tag',slug:id,label:id,parent_id:null,data:null,
      locale:'en',translation_group:id,sort_order:index}).execute();
  }
  const before=await rows(sql`SELECT translation_group,sort_order FROM _cms_taxonomies WHERE name='tag' ORDER BY sort_order`);
  await sql`CREATE TRIGGER taxonomy_fixture_fail_last_chunk BEFORE UPDATE OF sort_order ON _cms_taxonomies
    WHEN OLD.translation_group = 'term-000' BEGIN SELECT RAISE(ABORT, 'taxonomy fixture final chunk failure'); END`.execute(storage.db);
  const siblings=before.map(row=>({group:row.translation_group,position:row.sort_order}));
  await assert.rejects(repo.reorder(siblings.map(row=>row.group).reverse(),siblings), /taxonomy fixture final chunk failure/);
  assert.deepEqual(await rows(sql`SELECT translation_group,sort_order FROM _cms_taxonomies WHERE name='tag' ORDER BY sort_order`),before);
});

test('D1: replacing assignments preserves the old set if insertion fails', async () => {
  const first=await create({name:'tag',slug:'first',label:'First'});
  const second=await create({name:'tag',slug:'second',label:'Second'});
  await sql`INSERT INTO ec_post(id,slug,status,author_id,locale,translation_group,title) VALUES('entry','entry','published',NULL,'en','entry','Entry')`.execute(storage.db);
  await repo.attachToEntry('post','entry',first.id);
  await sql`CREATE TRIGGER taxonomy_fixture_fail_assignment BEFORE INSERT ON _cms_content_taxonomies
    WHEN NEW.taxonomy_id = ${sql.lit(second.id)} BEGIN SELECT RAISE(ABORT, 'taxonomy fixture assignment failure'); END`.execute(storage.db);
  await assert.rejects(repo.setTermsForEntry('post','entry','tag',[second.id]), /taxonomy fixture assignment failure/);
  assert.deepEqual((await rows(sql`SELECT taxonomy_id FROM _cms_content_taxonomies WHERE collection='post' AND entry_id='entry'`)).map(row=>row.taxonomy_id),[first.id]);
});

test('D1: deleting a whole taxonomy clears all locales, terms, groups and actual pivots', async () => {
  const api=await handlers();
  successful(await api.handleTaxonomyCreate(db,{name:'genre',label:'Genres',collections:['post']}));
  const term=successful(await api.handleTermCreate(db,'genre',{label:'Jazz'})).term;
  await sql`INSERT INTO ec_post(id,slug,status,author_id,locale,translation_group,title) VALUES('entry','entry','published',NULL,'en','entry','Entry')`.execute(storage.db);
  await repo.attachToEntry('post','entry',term.id);
  successful(await api.handleTaxonomyDelete(db,'genre'));
  assert.deepEqual(await rows(sql`SELECT id FROM _cms_taxonomies WHERE name='genre'`),[]);
  assert.deepEqual(await rows(sql`SELECT id FROM _cms_taxonomy_defs WHERE name='genre'`),[]);
  assert.deepEqual(await rows(sql`SELECT id FROM _cms_taxonomy_def_groups WHERE name='genre'`),[]);
  assert.deepEqual(await rows(sql`SELECT taxonomy_id FROM _cms_content_taxonomies WHERE taxonomy_id=${term.translationGroup}`),[]);
});

test('D1: actual canonical direct-write boundary remains active', async () => {
  await assert.rejects(db.insertInto('taxonomies').values({id:'bypass',name:'tag',slug:'bypass',label:'Bypass',parent_id:null,data:null,
    locale:'en',translation_group:'bypass',sort_order:0}).execute(), /D1 taxonomy writes require atomic adaptation/);
  assert.deepEqual(await rows(sql`SELECT id FROM _cms_taxonomies WHERE id='bypass'`),[]);
});
