import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sql } from 'kysely';
import { historicalFeatureStorage, type StorageMode } from './helpers/canonical-feature-storage-original.ts';
import { migrateCms } from '../src/lib/server/database/migrations.ts';
import { SchemaRegistry } from '../src/lib/server/database/registry.ts';
import { RelationRepository } from '../src/lib/server/relations/repository.ts';
import { relationService } from '../src/lib/server/relations/service.ts';
import { servicePrincipal } from '../src/lib/server/auth/composition.ts';
import { Role } from '../src/lib/server/auth/roles.ts';

for (const mode of ['Node', 'raw D1', 'scoped D1'] as const satisfies readonly StorageMode[]) {
  test(`${mode} failed duplicate copies preserve the original graph and write no partial copy`, async () => {
    const host = await historicalFeatureStorage(mode, 0);
    try {
      await migrateCms(host.database);
      const repo = new RelationRepository(host.database);
      const relation = await repo.create({slug:'duplicate_atomic',parentCollection:'post',childCollection:'page',parentLabel:'Post',childLabel:'Page'});
      const children = Array.from({length:40},(_,index)=>`child-${index}`);
      await repo.setChildren(relation.id,'original',children);
      await sql`CREATE TRIGGER relation_duplicate_abort BEFORE INSERT ON _cms_content_references
        WHEN NEW.parent_group = 'duplicate' AND NEW.child_group = 'child-17'
        BEGIN SELECT RAISE(ABORT, 'actual duplicate fixture failure'); END`.execute(host.database.db);
      await assert.rejects(repo.copyParentEdges('original','duplicate'),/actual duplicate fixture failure/);
      assert.deepEqual((await repo.getChildren(relation.id,'duplicate')).map(edge=>edge.childGroup),[]);
      assert.deepEqual((await repo.getChildren(relation.id,'original')).map(edge=>edge.childGroup),children);
    } finally { await host.close(); }
  });

  test(`${mode} failed relation deletion retains both bound fields and the actual graph`, async () => {
    const host = await historicalFeatureStorage(mode, 0);
    try {
      await migrateCms(host.database);
      const registry = new SchemaRegistry(host.database);
      await registry.createCollection({slug:'post',label:'Posts'});
      await registry.createCollection({slug:'page',label:'Pages'});
      const service = relationService(host.database,servicePrincipal({id:'ordinary-original-unit-admin',role:Role.ADMIN}));
      const created = await service.create({slug:'cascade_atomic',parentCollection:'post',childCollection:'page',parentLabel:'Post',childLabel:'Page'});
      assert.equal(created.success,true);
      if(!created.success)throw new Error(JSON.stringify(created));
      const id = created.data.relation.id;
      await registry.createField('post',{slug:'pages',label:'Pages',type:'reference',validation:{relation:'cascade_atomic',relationSide:'parent'}});
      await registry.createField('page',{slug:'posts',label:'Posts',type:'reference',validation:{relation:'cascade_atomic',relationSide:'child'}});
      await new RelationRepository(host.database).setChildren(id,'post-group',['page-group']);
      await sql`CREATE TRIGGER relation_cascade_abort BEFORE DELETE ON _cms_relations
        WHEN OLD.slug = 'cascade_atomic' BEGIN SELECT RAISE(ABORT, 'actual cascade fixture failure'); END`.execute(host.database.db);
      const deleted = await service.delete(id);
      assert.equal(deleted.success,false);
      assert.ok(await registry.getField('post','pages'));
      assert.ok(await registry.getField('page','posts'));
      assert.deepEqual((await new RelationRepository(host.database).getChildren(id,'post-group')).map(edge=>edge.childGroup),['page-group']);
      assert.ok(await new RelationRepository(host.database).findById(id));
    } finally { await host.close(); }
  });
}
