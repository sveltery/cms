import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sql } from 'kysely';
import { servicePrincipal } from '../src/lib/server/auth/composition.ts';
import { Role } from '../src/lib/server/auth/roles.ts';
import { migrateCms } from '../src/lib/server/database/migrations.ts';
import { openSqlite } from '../src/lib/server/database/sqlite.ts';
import { SchemaRegistry } from '../src/lib/server/database/registry.ts';

test('published runtime principal exposes exact existing relation route permissions', () => {
  const admin = servicePrincipal({id:'ordinary-source-admin-unit-context',role:Role.ADMIN});
  const editor = servicePrincipal({id:'ordinary-source-editor-unit-context',role:Role.EDITOR});
  assert.ok(admin?.permissions.includes('schema:manage'));
  assert.ok(editor?.permissions.includes('schema:read'));
  assert.ok(admin?.permissions.includes('content:read'));
  assert.ok(admin?.permissions.includes('content:read_drafts'));
});

test('relation definition service reports actual bound fields and deletes inverse metadata and edges', async () => {
  const database = openSqlite(':memory:');
  try {
    await migrateCms(database);
    const registry = new SchemaRegistry(database);
    await registry.createCollection({ slug:'post',label:'Posts' });
    await registry.createCollection({ slug:'page',label:'Pages' });
    const loaded = await import('../src/lib/server/relations/service.ts').catch(() => null);
    assert.equal(typeof loaded?.relationService,'function','actual relation service must exist');
    const service = loaded!.relationService(database, servicePrincipal({id:'ordinary-source-admin-unit-context',role:Role.ADMIN}));
    const created = await service.create({slug:'related_pages',parentCollection:'post',childCollection:'page',parentLabel:'Post',childLabel:'Pages'});
    assert.equal(created.success,true);
    if (!created.success) throw new Error(JSON.stringify(created));
    const id = created.data.relation.id;
    await registry.createField('post',{slug:'pages',label:'Pages',type:'reference',validation:{relation:'related_pages',relationSide:'parent'}});
    await registry.createField('page',{slug:'posts',label:'Posts',type:'reference',validation:{relation:'related_pages',relationSide:'child'}});
    await database.db.withTables<{_cms_content_references:{id:string;relation_id:string;parent_group:string;child_group:string;sort_order:number}}>()
      .insertInto('_cms_content_references').values({id:'actual-edge',relation_id:id,parent_group:'post-g',child_group:'page-g',sort_order:0}).execute();
    const get = await service.get(id);
    assert.equal(get.success,true);
    if (!get.success) throw new Error(JSON.stringify(get));
    assert.equal(get.data.relation.linkCount,1);
    assert.deepEqual(get.data.relation.boundFields.map(field=>[field.collectionSlug,field.fieldSlug,field.side]).sort(),[['page','posts','child'],['post','pages','parent']]);
    const deleted = await service.delete(id);
    assert.equal(deleted.success,true);
    assert.equal(await registry.getField('post','pages'),null);
    assert.equal(await registry.getField('page','posts'),null);
    assert.equal((await sql<{count:number}>`SELECT COUNT(*) AS count FROM _cms_content_references`.execute(database.db)).rows[0].count,0);
  } finally { await database.close(); }
});
