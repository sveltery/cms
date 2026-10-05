import test from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'kysely';
import { schemaAdminStorage } from './helpers/schema-admin-storage.ts';
import { migrateCms } from '../src/lib/server/database/migrations.ts';
import { cmsService } from '../src/lib/server/database/service.ts';
import { createBlockTypeRegistry } from '../src/lib/server/blocks/registry.ts';

// Supplemental actual storage contracts. Controlled principals only; no new
// protected HTTP/session/credential probe and no original Source credit.
for (const target of ['Node','D1'] as const) test(`${target} schema administration orders and deletes through the existing service and atomic registry`, async () => {
  const storage = await schemaAdminStorage(target);
  try {
    await migrateCms(storage.database);
    const service = cmsService(storage.database,{id:'schema-ui-owner',permissions:['schema:read','schema:manage']});
    for (const slug of ['posts','pages']) await service.createCollection({slug,label:slug});
    let collection = await service.getCollection('posts');
    await service.addField({collection:'posts',input:{slug:'title',label:'Title',type:'string'},expectedSchemaVersion:collection.version});
    collection = await service.getCollection('posts');
    await service.addField({collection:'posts',input:{slug:'score',label:'Score',type:'integer'},expectedSchemaVersion:collection.version});
    assert.equal(typeof service.reorderSchemaCollections,'function');
    await service.reorderSchemaCollections(['pages','posts']);
    assert.deepEqual((await service.listCollections()).map(value=>value.slug),['pages','posts']);
    await service.reorderSchemaFields({collection:'posts',fields:['score','title']});
    assert.deepEqual((await service.getCollection('posts')).fields.map(value=>value.slug),['score','title']);
    await service.deleteSchemaField({collection:'posts',field:'score'});
    assert.deepEqual((await service.getCollection('posts')).fields.map(value=>value.slug),['title']);
    assert.equal((await sql<{name:string}>`PRAGMA table_info(ec_posts)`.execute(storage.database.db)).rows.some(value=>value.name==='score'),false);
    await service.deleteSchemaCollection({collection:'pages'});
    assert.deepEqual((await service.listCollections()).map(value=>value.slug),['posts']);
  } finally { await storage.close(); }
});
test('schema field builder reads the actual canonical block type and version inventory', async () => {
  const storage = await schemaAdminStorage('Node');
  try {
    await migrateCms(storage.database);
    const blocks = createBlockTypeRegistry(storage.database);
    const created = await blocks.createBlockType({slug:'hero',label:'Hero',fields:[{slug:'heading',label:'Heading',type:'string'}]});
    const service = cmsService(storage.database,{id:'schema-ui-owner',permissions:['schema:read']});
    assert.equal(typeof service.listSchemaBlockTypes,'function');
    const inventory = await service.listSchemaBlockTypes();
    assert.deepEqual(inventory.map(value=>value.slug),['hero']);
    assert.deepEqual(inventory[0].versions,created.versions);
    assert.equal(inventory[0].versions[0].active,true);
  } finally { await storage.close(); }
});
