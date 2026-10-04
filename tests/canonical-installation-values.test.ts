// Original supplemental installation requirements. Zero copied Source assertions.
// The historical fixture is a complete actual normal public37d5 v5 installation;
// every NEW provider is reached solely through normal production migrateCms.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sql } from 'kysely';
import { migrateCms } from '../src/lib/server/database/migrations.ts';
import { CmsError, type CmsDatabase } from '../src/lib/server/database/contract.ts';
import { SchemaRegistry } from '../src/lib/server/database/registry.ts';
import { OptionsRepository } from './helpers/canonical-installation/options-repository.ts';
import { canonicalSourceDatabase } from '../src/lib/server/canonical-storage/namespace.ts';
import { canonicalStorage, storageTargets } from './helpers/canonical-installation/storage.ts';

interface CatalogueObject { name: string; type: string; tbl_name: string; sql: string }
const historical = JSON.parse(readFileSync(new URL('./fixtures/canonical-public-v5.json', import.meta.url), 'utf8')) as {
  publicCommit: string; objects: CatalogueObject[]; markers: { version: number }[];
};
async function catalogue(database: CmsDatabase) {
  return (await sql<CatalogueObject>`SELECT name,type,tbl_name,sql FROM sqlite_master
    WHERE sql IS NOT NULL ORDER BY name,type`.execute(database.db)).rows.map(row => ({...row}));
}
async function installHistorical(database: CmsDatabase) {
  assert.equal(historical.publicCommit, '37d5ed93a553c6ddef86c50a0eb596acbc9da63b');
  await database.atomicBatch([
    ...historical.objects.map(object => sql.raw(object.sql).compile(database.db)),
    ...historical.markers.map(marker => sql`INSERT INTO _cms_migrations(version) VALUES (${marker.version})`.compile(database.db))
  ]);
}
async function addMetadata(database: CmsDatabase) {
  // Use the real public registry to create a coherent historical metadata and
  // content layout. A metadata-only row is correctly rejected by provider5.
  const registry = new SchemaRegistry(database);
  await registry.createCollection({slug:'preserved',label:'Preserved'});
  return registry.createField('preserved', {slug:'name',label:'Name',type:'string',
    defaultValue:'a  literal',validation:{minLength:2},sortOrder:17,
    widget:'text',options:{placeholder:'a  b'},searchable:true,indexed:true,translatable:true});
}
async function metadata(database: CmsDatabase) {
  return (await sql`SELECT * FROM _cms_fields ORDER BY id`.execute(database.db)).rows;
}
const requiredVersions = [1,2,3,4,5,6,7,8];

for (const target of storageTargets) {
  test(`${target}: ordinary options persist across normal installation and reopen`, { timeout: 30_000 }, async () => {
    const h = await canonicalStorage(target);
    try {
      await migrateCms(h.database);
      const versions = await h.database.db.selectFrom('_cms_migrations').select('version').orderBy('version').execute();
      assert.deepEqual(versions.slice(0,8).map(row => row.version), requiredVersions);
      assert.deepEqual(versions.map(row => row.version), [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]);
      let options = new OptionsRepository(canonicalSourceDatabase(h.database));
      await options.set('site:title', 'A "quoted" site');
      await options.set('site:theme', { colors: ['blue', 'green'], padding: 'a  b' });
      await options.set('site:title', 'Published title');
      await h.reopen();
      await migrateCms(h.database);
      options = new OptionsRepository(canonicalSourceDatabase(h.database));
      assert.equal(await options.get('site:title'), 'Published title');
      assert.deepEqual(await options.get('site:theme'), { colors: ['blue', 'green'], padding: 'a  b' });
      assert.equal(await options.getOrDefault('site:missing', 'fallback'), 'fallback');
      assert.deepEqual(await h.database.db.selectFrom('_cms_migrations').select('version').orderBy('version').execute(), versions);
    } finally { await h.close(); }
  });

  test(`${target}: real taxonomy seeds defaults indexes and group pivot semantics`, { timeout: 30_000 }, async () => {
    const h = await canonicalStorage(target);
    try {
      await migrateCms(h.database);
      const names = (await catalogue(h.database)).map(row => row.name);
      assert.ok(names.includes('_cms_taxonomy_def_groups'));
      const definitions = (await sql<{id:string;name:string;label:string;label_singular:string|null;hierarchical:number;collections:string;locale:string;translation_group:string|null}>`SELECT id,name,label,label_singular,hierarchical,collections,locale,translation_group
        FROM _cms_taxonomy_defs ORDER BY id`.execute(h.database.db)).rows.map(row => ({...row}));
      assert.deepEqual(definitions, [
        { id:'taxdef_category',name:'category',label:'Categories',label_singular:'Category',hierarchical:1,collections:'["posts"]',locale:'en',translation_group:'taxdef_category' },
        { id:'taxdef_tag',name:'tag',label:'Tags',label_singular:'Tag',hierarchical:0,collections:'["posts"]',locale:'en',translation_group:'taxdef_tag' }
      ]);
      assert.deepEqual((await sql<{id:string;name:string;hierarchical:number;collections:string}>`SELECT id,name,hierarchical,collections FROM _cms_taxonomy_def_groups ORDER BY id`.execute(h.database.db)).rows.map(row => ({...row})),
        definitions.map(({id,name,hierarchical,collections}) => ({id,name,hierarchical,collections})));
      await sql`INSERT INTO _cms_taxonomies(id,name,slug,label,translation_group)
        VALUES ('term_parent','category','parent','Parent','group_parent')`.execute(h.database.db);
      await sql`INSERT INTO _cms_taxonomies(id,name,slug,label,parent_id,translation_group)
        VALUES ('term_child','category','child','Child','term_parent','group_child')`.execute(h.database.db);
      await sql`INSERT INTO _cms_content_taxonomies(collection,entry_id,taxonomy_id)
        VALUES ('posts','entry','group_child')`.execute(h.database.db);
      await sql`DELETE FROM _cms_taxonomies WHERE id='term_parent'`.execute(h.database.db);
      assert.deepEqual((await sql<{parent_id:string|null;locale:string;sort_order:number}>`SELECT parent_id,locale,sort_order FROM _cms_taxonomies WHERE id='term_child'`.execute(h.database.db)).rows.map(row => ({...row})),
        [{parent_id:null,locale:'en',sort_order:0}]);
      assert.deepEqual((await sql`PRAGMA foreign_key_list(_cms_content_taxonomies)`.execute(h.database.db)).rows, []);
      assert.ok(names.includes('idx_cms_taxonomies_translation_group_locale_unique'));
      for (const obsolete of ['idx_cms_content_taxonomies_created','idx_cms_content_taxonomies_published',
        'idx_cms_content_taxonomies_status','idx_cms_content_taxonomies_locale']) assert.equal(names.includes(obsolete), false);
      await sql`INSERT INTO _cms_plugin_state(plugin_id,version) VALUES ('ordinary-plugin','1.0.0')`.execute(h.database.db);
      const state = (await sql<{source:string;status:string;mcp_tools_enabled:number;installed_at:string|null}>`SELECT source,status,mcp_tools_enabled,installed_at
        FROM _cms_plugin_state WHERE plugin_id='ordinary-plugin'`.execute(h.database.db)).rows[0];
      assert.deepEqual({source:state.source,status:state.status,mcp_tools_enabled:state.mcp_tools_enabled},
        {source:'config',status:'installed',mcp_tools_enabled:0});
      assert.match(state.installed_at!, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    } finally { await h.close(); }
  });

  test(`${target}: normal v5 upgrade preserves every field and exact operator SQL`, { timeout: 30_000 }, async () => {
    const h = await canonicalStorage(target);
    try {
      await installHistorical(h.database);
      await addMetadata(h.database);
      await sql`CREATE TABLE operator_audit(message TEXT)`.execute(h.database.db);
      await sql`CREATE VIEW operator_fields AS SELECT id,label FROM _cms_fields`.execute(h.database.db);
      await sql`CREATE VIEW operator_indirect AS SELECT * FROM operator_fields`.execute(h.database.db);
      await sql`CREATE INDEX operator_field_index ON _cms_fields(label) WHERE label <> 'a  b'`.execute(h.database.db);
      await sql`CREATE TRIGGER operator_field_update AFTER UPDATE ON _cms_fields
        BEGIN INSERT INTO operator_audit(message) VALUES ('it''s  "preserved"'); END`.execute(h.database.db);
      const before = await metadata(h.database);
      const operatorObjects = (await catalogue(h.database)).filter(row => row.name.startsWith('operator_'));
      await migrateCms(h.database);
      assert.deepEqual(await metadata(h.database), before);
      assert.deepEqual((await catalogue(h.database)).filter(row => row.name.startsWith('operator_')), operatorObjects);
      assert.deepEqual((await sql`SELECT * FROM operator_audit`.execute(h.database.db)).rows, []);
      await sql`UPDATE _cms_fields SET label='Updated' WHERE slug='name'`.execute(h.database.db);
      assert.deepEqual((await sql<{message:string}>`SELECT * FROM operator_audit`.execute(h.database.db)).rows.map(row => ({...row})), [{message:'it\'s  "preserved"'}]);
      // Keep the physical content layout coherent when exercising the new
      // metadata FK directly; provider5 correctly refuses orphan ec tables.
      await sql`DROP TABLE ec_preserved`.execute(h.database.db);
      await sql`DELETE FROM _cms_collections WHERE slug='preserved'`.execute(h.database.db);
      assert.deepEqual(await metadata(h.database), []);
      await h.reopen();
      await migrateCms(h.database);
      assert.deepEqual((await catalogue(h.database)).filter(row => row.name.startsWith('operator_')), operatorObjects);
    } finally { await h.close(); }
  });

  test(`${target}: failed normal metadata upgrade rolls back all providers and preserves v5 values`, { timeout: 30_000 }, async () => {
    const h = await canonicalStorage(target);
    try {
      await installHistorical(h.database);
      await addMetadata(h.database);
      const before = await catalogue(h.database);
      const fields = await metadata(h.database);
      let injected = false;
      const failing: CmsDatabase = { db:h.database.db,close:() => h.database.close(),
        atomicBatch(statements) {
          const upgrade = statements.findIndex(statement => /ALTER TABLE _cms_collections ADD COLUMN search_config/.test(statement.sql));
          if (upgrade >= 0) {
            injected = true;
            return h.database.atomicBatch([...statements.slice(0,upgrade+1),
              sql`INSERT INTO missing_ordinary_rollback_table(value) VALUES ('fail')`.compile(h.database.db),
              ...statements.slice(upgrade+1)]);
          }
          return h.database.atomicBatch(statements);
        }
      };
      await assert.rejects(() => migrateCms(failing), /missing_ordinary_rollback_table/);
      assert.equal(injected, true);
      assert.deepEqual(await catalogue(h.database), before);
      assert.deepEqual(await metadata(h.database), fields);
      assert.deepEqual((await h.database.db.selectFrom('_cms_migrations').selectAll().orderBy('version').execute()).map(row => ({...row})), historical.markers);
    } finally { await h.close(); }
  });

  test(`${target}: external metadata foreign keys refuse the normal upgrade before writes`, { timeout: 30_000 }, async () => {
    const h = await canonicalStorage(target);
    try {
      await installHistorical(h.database);
      const field = await addMetadata(h.database);
      await sql`CREATE TABLE operator_field_children(id TEXT PRIMARY KEY,field_id TEXT
        REFERENCES _cms_fields(id) ON DELETE CASCADE)`.execute(h.database.db);
      await sql`INSERT INTO operator_field_children VALUES ('child',${field.id})`.execute(h.database.db);
      const before = await catalogue(h.database);
      let batches = 0;
      const monitored: CmsDatabase = { db:h.database.db,close:() => h.database.close(),
        atomicBatch(statements) { batches++; return h.database.atomicBatch(statements); } };
      await assert.rejects(() => migrateCms(monitored), error => error instanceof CmsError && error.code === 'MIGRATION_REQUIRED');
      assert.equal(batches, 0);
      assert.deepEqual(await catalogue(h.database), before);
      assert.deepEqual((await sql<{id:string;field_id:string}>`SELECT * FROM operator_field_children`.execute(h.database.db)).rows.map(row => ({...row})), [{id:'child',field_id:field.id}]);
    } finally { await h.close(); }
  });

  test(`${target}: missing or changed owned trigger refuses normal readiness without writes`, { timeout: 30_000 }, async () => {
    const h = await canonicalStorage(target);
    try {
      await migrateCms(h.database);
      const triggers = (await catalogue(h.database)).filter(row => row.type === 'trigger' && row.name.startsWith('_cms_options_revision_'));
      assert.equal(triggers.length, 2);
      await sql`DROP TRIGGER _cms_options_revision_update`.execute(h.database.db);
      await sql`CREATE TRIGGER _cms_options_revision_update AFTER UPDATE ON _cms_options
        BEGIN SELECT 'changed  semantics'; END`.execute(h.database.db);
      const before = await catalogue(h.database);
      await assert.rejects(() => migrateCms(h.database), error => error instanceof CmsError && error.code === 'MIGRATION_REQUIRED');
      assert.deepEqual(await catalogue(h.database), before);
      await sql`DROP TRIGGER _cms_options_revision_update`.execute(h.database.db);
      await assert.rejects(() => migrateCms(h.database), error => error instanceof CmsError && error.code === 'MIGRATION_REQUIRED');
    } finally { await h.close(); }
  });
}
