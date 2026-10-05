// Original finite C-07 capability requirements. Zero Source declarations.
// Whole product modules are imported; no protected Source family is executed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'kysely';
import { migrateCms } from '../src/lib/server/database/migrations.ts';
import { SchemaRegistry } from '../src/lib/server/database/registry.ts';
import { canonicalSourceDatabase } from '../src/lib/server/canonical-storage/namespace.ts';
import { saveTaxonomyStructure } from '../src/lib/server/taxonomies/definitions.ts';
import { canonicalStorage } from './helpers/canonical-installation/storage.ts';
import { OptionsRepository } from './helpers/canonical-installation/options-repository.ts';
import { TaxonomyRepository } from './helpers/canonical-installation/taxonomy-repository.ts';
import { databaseSnapshot } from './helpers/lifecycle-startup.ts';

const cases = ['structured insert','structured update','structured delete','whole Source delete',
  'whole Source reorder','whole Source pivot replacement','whole Source structure save'] as const;
for (const target of ['raw D1','scoped D1'] as const) {
  for (const action of cases) {
    test(`${target}: ${action} uses only its actual atomic capability`, {timeout:30_000}, async () => {
      const h = await canonicalStorage(target);
      try {
        await migrateCms(h.database);
        await new SchemaRegistry(h.database).createCollection({slug:'post',label:'Posts'});
        await sql`INSERT INTO ec_post(id,translation_group) VALUES ('entry','entry')`.execute(h.database.db);
        await sql`INSERT INTO _cms_taxonomies(id,name,slug,label,translation_group,sort_order)
          VALUES ('term_a','category','a','A','term_a',0),('term_b','category','b','B','term_b',1)`.execute(h.database.db);
        await sql`INSERT INTO _cms_content_taxonomies(collection,entry_id,taxonomy_id)
          VALUES ('post','entry','term_a')`.execute(h.database.db);
        const db = canonicalSourceDatabase(h.database);
        const repository = new TaxonomyRepository(db);
        const writes: Record<typeof cases[number], () => Promise<unknown>> = {
          'structured insert': () => db.insertInto('taxonomies').values({id:'added',name:'category',slug:'added',label:'Added',parent_id:null,data:null,translation_group:'added'}).execute(),
          'structured update': () => db.updateTable('taxonomies').set({label:'Changed'}).where('id','=','term_a').execute(),
          'structured delete': () => db.deleteFrom('taxonomies').where('id','=','term_a').execute(),
          'whole Source delete': () => repository.delete('term_a'),
          'whole Source reorder': () => repository.reorder(['term_b','term_a'],[{group:'term_a',position:0},{group:'term_b',position:1}]),
          'whole Source pivot replacement': () => repository.setTermsForEntry('post','entry','category',['term_b']),
          'whole Source structure save': () => saveTaxonomyStructure(db,'category','new_group',{hierarchical:false,collections:['post']})
        };
        if(action.startsWith('structured ')) {
          const before=await databaseSnapshot(h.database);
          await assert.rejects(writes[action],/D1 taxonomy writes require atomic adaptation/);
          assert.deepEqual(await databaseSnapshot(h.database),before);
        } else {
          // Historical readiness expectations are superseded only for genuine
          // installed atomic capabilities. Direct-write guards above stay exact.
          await sql`INSERT INTO _cms_taxonomy_def_groups(id,name,hierarchical,collections)
            VALUES ('old_group','category',1,'[]')`.execute(h.database.db);
          await sql`INSERT INTO _cms_taxonomy_defs(id,name,label,label_singular,translation_group,hierarchical,collections)
            VALUES ('def_category','category','Category','Category','old_group',1,'[]')`.execute(h.database.db);
          const failures={
            'whole Source delete': sql`CREATE TRIGGER taxonomy_atomic_failure BEFORE DELETE ON _cms_taxonomies
              WHEN OLD.id='term_a' BEGIN SELECT RAISE(ABORT,'actual taxonomy atomic failure'); END`,
            'whole Source reorder': sql`CREATE TRIGGER taxonomy_atomic_failure BEFORE UPDATE OF sort_order ON _cms_taxonomies
              WHEN NEW.id='term_a' BEGIN SELECT RAISE(ABORT,'actual taxonomy atomic failure'); END`,
            'whole Source pivot replacement': sql`CREATE TRIGGER taxonomy_atomic_failure BEFORE INSERT ON _cms_content_taxonomies
              WHEN NEW.taxonomy_id='term_b' BEGIN SELECT RAISE(ABORT,'actual taxonomy atomic failure'); END`,
            'whole Source structure save': sql`CREATE TRIGGER taxonomy_atomic_failure BEFORE UPDATE ON _cms_taxonomy_defs
              WHEN NEW.name='category' BEGIN SELECT RAISE(ABORT,'actual taxonomy atomic failure'); END`
          };
          await failures[action as keyof typeof failures].execute(h.database.db);
          const before=await databaseSnapshot(h.database);
          await assert.rejects(writes[action],/actual taxonomy atomic failure/);
          assert.deepEqual(await databaseSnapshot(h.database),before);
          await sql`DROP TRIGGER taxonomy_atomic_failure`.execute(h.database.db);
          await writes[action]();
          if(action==='whole Source delete') {
            assert.equal(await repository.findById('term_a'),null);
            assert.ok(await repository.findById('term_b'));
            assert.deepEqual((await sql`SELECT * FROM _cms_content_taxonomies`.execute(h.database.db)).rows,[]);
          } else if(action==='whole Source reorder') {
            assert.equal((await repository.findById('term_b'))!.sortOrder,0);
            assert.equal((await repository.findById('term_a'))!.sortOrder,1);
          } else if(action==='whole Source pivot replacement') {
            assert.deepEqual((await sql<{taxonomy_id:string}>`SELECT taxonomy_id FROM _cms_content_taxonomies`.execute(h.database.db)).rows,[{taxonomy_id:'term_b'}]);
          } else {
            assert.deepEqual((await sql`SELECT id,hierarchical,collections FROM _cms_taxonomy_def_groups`.execute(h.database.db)).rows,
              [{id:'old_group',hierarchical:0,collections:'["post"]'}]);
            assert.deepEqual((await sql`SELECT translation_group,hierarchical,collections FROM _cms_taxonomy_defs`.execute(h.database.db)).rows,
              [{translation_group:'old_group',hierarchical:0,collections:'["post"]'}]);
          }
        }
      } finally { await h.close(); }
    });
  }
  test(`${target}: ordinary option storage and whole taxonomy reads remain available`, {timeout:30_000}, async () => {
    const h = await canonicalStorage(target);
    try {
      await migrateCms(h.database);
      await sql`INSERT INTO _cms_taxonomies(id,name,slug,label,translation_group)
        VALUES ('read_term','category','read','Read','read_term')`.execute(h.database.db);
      const db = canonicalSourceDatabase(h.database);
      const options = new OptionsRepository(db);
      await options.set('site:title','Ordinary title');
      assert.equal(await options.get('site:title'),'Ordinary title');
      const repository = new TaxonomyRepository(db);
      assert.equal((await repository.findById('read_term'))?.label,'Read');
      assert.equal((await repository.findPageByName('category')).items[0]?.id,'read_term');
      assert.equal(await options.delete('site:title'),true);
      assert.equal(await options.get('site:title'),null);
    } finally { await h.close(); }
  });
}
