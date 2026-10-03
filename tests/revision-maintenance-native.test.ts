// Original requirements; zero copied Source declaration credit.
import assert from 'node:assert/strict';
import {it} from 'node:test';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {sql} from 'kysely';
import {schemaAdminStorage} from './helpers/schema-admin-storage.ts';
import {migrateCms} from '../src/lib/server/database/migrations.ts';
import {SchemaRegistry} from '../src/lib/server/database/registry.ts';
import {RevisionRepository} from '../src/lib/server/database/lifecycle/upstream/database/repositories/revision.ts';
import {revisionModule,runtimeModule} from './helpers/revision-maintenance/fixture.ts';
import {asyncD1Storage} from './helpers/async-d1-storage.ts';
import {openD1} from '../src/lib/server/database/d1.ts';

async function fixture(target:'Node'|'D1',directory?:string) {
  const storage=await schemaAdminStorage(target,directory);
  await migrateCms(storage.database);
  const registry=new SchemaRegistry(storage.database);
  for(const slug of ['post','page']) {
    await registry.createCollection({slug,label:slug});
    await registry.createField(slug,{slug:'title',label:'Title',type:'string'});
  }
  const db=storage.database.db as any;
  const revisions=new RevisionRepository(db);
  async function entry(collection:string,id:string,count:number) {
    await sql`INSERT INTO ${sql.ref('ec_'+collection)} (id,slug,status,created_at,updated_at,version)
      VALUES (${id},${id},'draft','2026-01-01T00:00:00.000Z','2026-01-01T00:00:00.000Z',1)`.execute(db);
    const items=[];
    for(let index=0;index<count;index++)items.push(await revisions.create({collection,entryId:id,data:{title:`Revision ${index}`}}));
    return items;
  }
  return {...storage,db,revisions,entry};
}
async function coordinator() {
  const module=await revisionModule();
  assert.equal(typeof module.pruneQueuedRevisions,'function','A global queued-revision maintenance coordinator must exist');
  return module.pruneQueuedRevisions;
}

for(const target of ['Node','D1'] as const) {
  it(`${target}: global maintenance consumes the oldest ten snapshots across collections`,async()=>{
    const stored=await fixture(target);
    try {
      const snapshots=[];
      for(let index=0;index<11;index++) {
        const collection=index%2?'page':'post',id=index===0?'z-oldest':`a-${index}`;
        const [revision]=await stored.entry(collection,id,1);
        snapshots.push({collection,entry_id:id,revision_id:revision.id});
      }
      assert.equal(await (await coordinator())(stored.db),0);
      assert.deepEqual((await sql<{collection:string;entry_id:string;revision_id:string}>`SELECT collection,entry_id,revision_id FROM _cms_revision_prune_queue`.execute(stored.db)).rows.map(row=>({...row})),[snapshots[10]]);
      assert.equal(await (await coordinator())(stored.db),0);
      assert.equal((await sql`SELECT * FROM _cms_revision_prune_queue`.execute(stored.db)).rows.length,0);
    }finally{await stored.close();}
  });
  it(`${target}: an actual prune SQL failure leaves that entry queued and continues the batch`,async()=>{
    const stored=await fixture(target);
    const errors:unknown[][]=[];const original=console.error;console.error=(...args)=>errors.push(args);
    try {
      await stored.entry('post','failed',56);
      await stored.entry('page','healthy',56);
      await sql`CREATE TRIGGER native_prune_failure BEFORE DELETE ON _cms_revisions WHEN OLD.entry_id='failed'
        BEGIN SELECT RAISE(ABORT,'native revision prune failure'); END`.execute(stored.db);
      assert.equal(await (await coordinator())(stored.db),6);
      assert.equal(await stored.revisions.countByEntry('post','failed'),56);
      assert.equal(await stored.revisions.countByEntry('page','healthy'),50);
      assert.deepEqual((await sql<{entry_id:string}>`SELECT entry_id FROM _cms_revision_prune_queue`.execute(stored.db)).rows.map(row=>({...row})),[{entry_id:'failed'}]);
      assert.equal(errors.length,1);
      assert.match(String(errors[0][0]),/post\/failed/);
      await sql`DROP TRIGGER native_prune_failure`.execute(stored.db);
      assert.equal(await (await coordinator())(stored.db),6);
      assert.equal(await stored.revisions.countByEntry('post','failed'),50);
    }finally{console.error=original;await stored.close();}
  });
  it(`${target}: a later queue write survives global snapshot acknowledgement`,async()=>{
    const stored=await fixture(target);
    try {
      await stored.entry('post','snapshot',51);
      let inserted=false,newId:string|undefined;
      const queuedReads=new WeakSet<object>();
      const plugin={transformQuery({node,queryId}:any){
        if(!inserted&&node.kind==='SelectQueryNode'&&JSON.stringify(node).includes('_cms_revision_prune_queue'))queuedReads.add(queryId);
        return node;
      },async transformResult({result,queryId}:any){
        if(queuedReads.has(queryId)){inserted=true;newId=(await stored.revisions.create({collection:'post',entryId:'snapshot',data:{title:'New draft'}})).id;
          await stored.entry('page','later-entry',1);}
        return result;
      }};
      assert.equal(await (await coordinator())(stored.db.withPlugin(plugin)),1);
      assert.equal(await stored.revisions.countByEntry('post','snapshot'),51);
      assert.ok(await stored.revisions.findById(newId!));
      assert.deepEqual((await sql<{revision_id:string}>`SELECT revision_id FROM _cms_revision_prune_queue WHERE entry_id='snapshot'`.execute(stored.db)).rows.map(row=>({...row})),[{revision_id:newId}]);
      assert.equal((await sql`SELECT * FROM _cms_revision_prune_queue WHERE entry_id='later-entry'`.execute(stored.db)).rows.length,1);
      assert.equal(await (await coordinator())(stored.db),1);
      assert.equal(await stored.revisions.countByEntry('post','snapshot'),50);
    }finally{await stored.close();}
  });
  it(`${target}: an empty global queue never reads or deletes revision history`,async()=>{
    const stored=await fixture(target);
    try {
      const queries:string[]=[];
      const db=stored.db.withPlugin({transformQuery({node}:any){queries.push(JSON.stringify(node));return node;},transformResult:async({result}:any)=>result});
      assert.equal(await (await coordinator())(db),0);
      assert.equal(queries.length,1);
      assert.ok(queries[0].includes('_cms_revision_prune_queue'));
      assert.equal(queries.some(query=>query.includes('"name":"_cms_revisions"')),false);
    }finally{await stored.close();}
  });
  it(`${target}: global pruning keeps older protected live and draft pointers`,async()=>{
    const stored=await fixture(target);
    try {
      const revisions=await stored.entry('post','protected',60);
      await sql`UPDATE ec_post SET live_revision_id=${revisions[0].id},draft_revision_id=${revisions[1].id} WHERE id='protected'`.execute(stored.db);
      assert.equal(await (await coordinator())(stored.db),8);
      assert.equal(await stored.revisions.countByEntry('post','protected'),52);
      assert.ok(await stored.revisions.findById(revisions[0].id));
      assert.ok(await stored.revisions.findById(revisions[1].id));
      assert.equal((await sql`SELECT * FROM _cms_revision_prune_queue`.execute(stored.db)).rows.length,0);
    }finally{await stored.close();}
  });
}
it('Node: the trusted maintenance entry opens real persistent storage and can run again after restart',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'cms-revision-maintenance-node-'));
  let stored=await fixture('Node',directory);
  try {
    await stored.entry('post','restart',55);await stored.close();
    const module=await runtimeModule();
    assert.equal(typeof module.runRevisionMaintenance,'function','A trusted storage-owning maintenance entry must exist');
    const configuration={kind:'sqlite' as const,path:join(directory,'schema.sqlite')};
    assert.deepEqual(await module.runRevisionMaintenance(configuration),{revisionsPruned:5});
    assert.deepEqual(await module.runRevisionMaintenance(configuration),{revisionsPruned:0});
    stored=await schemaAdminStorage('Node',directory) as any;
    const revisions=new RevisionRepository(stored.database.db as any);
    assert.equal(await revisions.countByEntry('post','restart'),50);
  }finally{await stored.close();await rm(directory,{recursive:true,force:true});}
});
it('D1: the trusted maintenance entry uses the actual Worker D1 binding and persists across runtime reopen',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'cms-revision-maintenance-d1-'));
  let storage=await asyncD1Storage(directory);
  let database=openD1(storage.binding);
  try {
    await migrateCms(database);
    const registry=new SchemaRegistry(database);
    await registry.createCollection({slug:'post',label:'Posts'});
    await registry.createField('post',{slug:'title',label:'Title',type:'string'});
    await sql`INSERT INTO ec_post (id,slug,status,created_at,updated_at,version)
      VALUES ('reopen','reopen','draft','2026-01-01T00:00:00.000Z','2026-01-01T00:00:00.000Z',1)`.execute(database.db);
    const revisions=new RevisionRepository(database.db as any);
    for(let index=0;index<55;index++)await revisions.create({collection:'post',entryId:'reopen',data:{title:`Revision ${index}`}});
    const module=await runtimeModule();
    assert.equal(typeof module.runRevisionMaintenance,'function','A trusted storage-owning maintenance entry must exist');
    assert.deepEqual(await module.runRevisionMaintenance({kind:'d1',binding:storage.binding}),{revisionsPruned:5});
    await database.close();await storage.runtime.dispose();
    storage=await asyncD1Storage(directory);database=openD1(storage.binding);
    assert.equal(await new RevisionRepository(database.db as any).countByEntry('post','reopen'),50);
    assert.deepEqual(await module.runRevisionMaintenance({kind:'d1',binding:storage.binding}),{revisionsPruned:0});
  }finally{await database.close();await storage.runtime.dispose();await rm(directory,{recursive:true,force:true});}
});
it('Worker: a trusted scheduled handler must expose actual revision maintenance without a public route',async()=>{
  const module=await runtimeModule();
  assert.equal(typeof module.createRevisionMaintenanceScheduledHandler,'function','A trusted Worker scheduled maintenance seam must exist');
});
