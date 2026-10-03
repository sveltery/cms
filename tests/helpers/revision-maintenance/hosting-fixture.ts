// Original host requirements; no copied Source declarations or security credit.
import assert from 'node:assert/strict';
import {sql} from 'kysely';
import type {CmsDatabase} from '../../../src/lib/server/database/contract.ts';
import {migrateCms} from '../../../src/lib/server/database/migrations.ts';
import {SchemaRegistry} from '../../../src/lib/server/database/registry.ts';
import {RevisionRepository} from '../../../src/lib/server/database/lifecycle/upstream/database/repositories/revision.ts';

export async function seedMaintenance(database:CmsDatabase) {
  await migrateCms(database);
  const registry=new SchemaRegistry(database);
  await registry.createCollection({slug:'post',label:'Posts'});
  await registry.createField('post',{slug:'title',label:'Title',type:'string'});
  const revisions=new RevisionRepository(database.db as any);
  const protectedIds:string[]=[];
  for(const id of ['ordinary','protected']) {
    await sql`INSERT INTO ec_post(id,slug,status,created_at,updated_at,version)
      VALUES(${id},${id},'draft','2026-01-01T00:00:00.000Z','2026-01-01T00:00:00.000Z',1)`.execute(database.db);
    for(let index=0;index<55;index++) {
      const revision=await revisions.create({collection:'post',entryId:id,data:{title:`${id} ${index}`}});
      if(id==='protected'&&index<2)protectedIds.push(revision.id);
    }
  }
  await sql`UPDATE ec_post SET live_revision_id=${protectedIds[0]},draft_revision_id=${protectedIds[1]} WHERE id='protected'`.execute(database.db);
  return protectedIds;
}

export async function observeMaintenance(database:CmsDatabase,protectedIds:string[]) {
  const revisions=new RevisionRepository(database.db as any);
  assert.equal(await revisions.countByEntry('post','ordinary'),50);
  // The pinned policy retains the latest50 plus referenced older revisions.
  assert.equal(await revisions.countByEntry('post','protected'),52);
  assert.deepEqual((await sql<{live_revision_id:string;draft_revision_id:string}>`SELECT live_revision_id,draft_revision_id FROM ec_post WHERE id='protected'`.execute(database.db)).rows.map(row=>({...row})),
    [{live_revision_id:protectedIds[0],draft_revision_id:protectedIds[1]}]);
  for(const id of protectedIds)assert.ok(await revisions.findById(id));
  assert.equal((await sql`SELECT * FROM _cms_revision_prune_queue`.execute(database.db)).rows.length,0);
}
