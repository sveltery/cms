import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sql } from 'kysely';
import { historicalFeatureStorage, type StorageMode } from './helpers/canonical-feature-storage-original.ts';
import { migrateCms } from '../src/lib/server/database/migrations.ts';
import { RelationRepository } from '../src/lib/server/relations/repository.ts';

// Supplemental Native planner requirements. Missing-export baseline is availability
// assertion evidence only; it grants no original Source causal-red credit.
for (const mode of ['Node', 'raw D1', 'scoped D1'] as const satisfies readonly StorageMode[]) {
  test(`${mode} relation content plans defer all writes and compose both sides in one real batch`, async () => {
    const host = await historicalFeatureStorage(mode, 0);
    try {
      await migrateCms(host.database);
      const repository = new RelationRepository(host.database);
      const relation = await repository.create({slug:'content_plan',parentCollection:'post',childCollection:'page',parentLabel:'Posts',childLabel:'Pages'});
      await repository.setChildren(relation.id,'source',['old','retained']);
      const original = await repository.getChildren(relation.id,'source');
      const loaded = await import('../src/lib/server/relations/content-plan.ts').catch(()=>null);
      assert.equal(typeof loaded?.prepareContentReferenceWrites,'function','actual read-only compiled planner must exist');
      const plan = await loaded!.prepareContentReferenceWrites(host.database,[{relation:relation.id,side:'parent',entryGroup:'source',groups:['retained','new','retained']}]);
      assert.deepEqual(await repository.getChildren(relation.id,'source'),original,'preparation must execute no writes');
      assert.deepEqual(plan.touchedCollections,['post','page']);
      assert.ok([...plan.before,...plan.after,...plan.cleanup].every(statement=>statement.parameters.length<=100));
      await host.database.atomicBatch([...plan.before,...plan.after,...plan.cleanup]);
      const changed = await repository.getChildren(relation.id,'source');
      assert.deepEqual(changed.map(edge=>[edge.childGroup,edge.sortOrder]),[['retained',0],['new',1]]);
      assert.equal(changed[0].id,original[1].id,'retained edge identity is preserved');
      const inverse = await loaded!.prepareContentReferenceWrites(host.database,[{relation:relation.id,side:'child',entryGroup:'new',groups:['source','other']}]);
      await host.database.atomicBatch([...inverse.before,...inverse.after,...inverse.cleanup]);
      assert.deepEqual((await repository.getParents(relation.id,'new')).map(edge=>edge.parentGroup).sort(),['other','source']);
      assert.equal((await repository.getChildren(relation.id,'other'))[0].sortOrder,0);
    } finally { await host.close(); }
  });

  test(`${mode} a later content statement failure rolls back every prepared reference selection`, async () => {
    const host = await historicalFeatureStorage(mode,0);
    try {
      await migrateCms(host.database);
      const repository = new RelationRepository(host.database);
      const relation = await repository.create({slug:'content_abort',parentCollection:'post',childCollection:'page',parentLabel:'Posts',childLabel:'Pages'});
      await repository.setChildren(relation.id,'source',['old']);
      const before = await repository.getChildren(relation.id,'source');
      const loaded = await import('../src/lib/server/relations/content-plan.ts').catch(()=>null);
      assert.equal(typeof loaded?.prepareContentReferenceWrites,'function','actual read-only compiled planner must exist');
      const plan = await loaded!.prepareContentReferenceWrites(host.database,[{relation:relation.id,side:'parent',entryGroup:'source',groups:['replacement']}]);
      const lateFailure = sql`INSERT INTO _cms_guards(token,pass) VALUES ('actual-content-plan-late-abort',0)`.compile(host.database.db);
      await assert.rejects(host.database.atomicBatch([...plan.before,...plan.after,lateFailure,...plan.cleanup]),/CHECK constraint failed/);
      assert.deepEqual(await repository.getChildren(relation.id,'source'),before);
      assert.equal(Number((await sql<{count:number}>`SELECT COUNT(*) AS count FROM _cms_guards`.execute(host.database.db)).rows[0].count),0);
    } finally { await host.close(); }
  });
}

for (const mode of ['Node','raw D1','scoped D1'] as const satisfies readonly StorageMode[]) {
 test(`${mode} one content plan preserves sequential append order across inverse selections`,async()=>{
  const host=await historicalFeatureStorage(mode,0);
  try{
   await migrateCms(host.database);
   const repository=new RelationRepository(host.database);
   const relation=await repository.create({slug:'same_parent_append',parentCollection:'post',childCollection:'page',parentLabel:'Posts',childLabel:'Pages'});
   const {prepareContentReferenceWrites}=await import('../src/lib/server/relations/content-plan.ts');
   const plan=await prepareContentReferenceWrites(host.database,[
    {relation:relation.id,side:'child',entryGroup:'first-page',groups:['same-post']},
    {relation:relation.id,side:'child',entryGroup:'second-page',groups:['same-post']}
   ]);
   await host.database.atomicBatch([...plan.before,...plan.after,...plan.cleanup]);
   assert.deepEqual((await repository.getChildren(relation.id,'same-post')).map(edge=>[edge.childGroup,edge.sortOrder]),[['first-page',0],['second-page',1]]);
  }finally{await host.close();}
 });
}
