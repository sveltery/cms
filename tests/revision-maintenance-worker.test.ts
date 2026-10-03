// Original local workerd scheduling requirement. No deployed/cron cadence credit.
import assert from 'node:assert/strict';
import {it} from 'node:test';
import {mkdtemp,writeFile,readFile,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {build} from 'vite';
import {Miniflare,CorePaths} from 'miniflare';
import {runtimeModule} from './helpers/revision-maintenance/fixture.ts';

it('workerd: a real scheduled event anchors global pruning and keeps persistent D1 state across restart',async()=>{
  const module=await runtimeModule();
  assert.equal(typeof module.createRevisionMaintenanceScheduledHandler,'function','Actual scheduled-event revision maintenance must exist');
  const directory=await mkdtemp(join(tmpdir(),'cms-revision-scheduled-'));
  let worker:Miniflare|undefined;
  try {
    // This unpublished fixture's fetch API only seeds and observes test storage.
    // The product exports scheduled maintenance and no anonymous HTTP endpoint.
    const root=resolve('.');
    await symlink(join(root,'node_modules'),join(directory,'node_modules'));
    await writeFile(join(directory,'fixture.ts'),`
import {sql} from 'kysely';
import {createRevisionMaintenanceScheduledHandler} from ${JSON.stringify(join(root,'src/lib/server/maintenance/runtime.ts'))};
import {openD1} from ${JSON.stringify(join(root,'src/lib/server/database/d1.ts'))};
import {migrateCms} from ${JSON.stringify(join(root,'src/lib/server/database/migrations.ts'))};
import {SchemaRegistry} from ${JSON.stringify(join(root,'src/lib/server/database/registry.ts'))};
import {RevisionRepository} from ${JSON.stringify(join(root,'src/lib/server/database/lifecycle/upstream/database/repositories/revision.ts'))};
const handler=createRevisionMaintenanceScheduledHandler();
let anchors=0;
export default {
 scheduled(controller,env,ctx){handler.scheduled(controller,env,{waitUntil(task){anchors++;ctx.waitUntil(task);}});},
 async fetch(request,env){
  const database=openD1(env.CMS_DB);
  try {
   await migrateCms(database);
   const revisions=new RevisionRepository(database.db);
   if(new URL(request.url).pathname==='/seed'){
    const registry=new SchemaRegistry(database);
    await registry.createCollection({slug:'post',label:'Posts'});
    await registry.createField('post',{slug:'title',label:'Title',type:'string'});
    await sql\`INSERT INTO ec_post(id,slug,status,created_at,updated_at,version) VALUES('scheduled','scheduled','draft','2026-01-01T00:00:00.000Z','2026-01-01T00:00:00.000Z',1)\`.execute(database.db);
    for(let index=0;index<55;index++)await revisions.create({collection:'post',entryId:'scheduled',data:{title:'Revision '+index}});
   }
   return Response.json({anchors,count:await revisions.countByEntry('post','scheduled'),queued:(await sql\`SELECT * FROM _cms_revision_prune_queue\`.execute(database.db)).rows.length});
  }finally{await database.close();}
 }
};
`);
    await build({configFile:false,root,logLevel:'warn',ssr:{noExternal:true},build:{ssr:true,target:'es2022',outDir:join(directory,'build'),rollupOptions:{input:join(directory,'fixture.ts'),external:[/^node:/],output:{inlineDynamicImports:true,entryFileNames:'worker.mjs'}}}});
    const contents=await readFile(join(directory,'build/worker.mjs'),'utf8');
    const options={modulesRoot:directory,modules:[{type:'ESModule' as const,path:join(directory,'worker.mjs'),contents}],compatibilityDate:'2026-05-07',compatibilityFlags:['nodejs_compat'],cf:false,host:'127.0.0.1',port:0,d1Databases:{CMS_DB:'revision-scheduled'},d1Persist:join(directory,'d1')};
    worker=new Miniflare(options);await worker.ready;
    assert.deepEqual(await (await worker.dispatchFetch('http://fixture.invalid/seed')).json(),{anchors:0,count:55,queued:1});
    const scheduled=await worker.dispatchFetch(`http://fixture.invalid${CorePaths.SCHEDULED}?cron=*+*+*+*+*&time=1780272000000`);
    assert.equal(scheduled.status,200);
    assert.deepEqual(await (await worker.dispatchFetch('http://fixture.invalid/observe')).json(),{anchors:1,count:50,queued:0});
    await worker.dispose();worker=new Miniflare(options);await worker.ready;
    const repeated=await worker.dispatchFetch(`http://fixture.invalid${CorePaths.SCHEDULED}?cron=*+*+*+*+*&time=1780272060000`);
    assert.equal(repeated.status,200);
    assert.deepEqual(await (await worker.dispatchFetch('http://fixture.invalid/observe')).json(),{anchors:1,count:50,queued:0});
  }finally{await worker?.dispose();await rm(directory,{recursive:true,force:true});}
});
