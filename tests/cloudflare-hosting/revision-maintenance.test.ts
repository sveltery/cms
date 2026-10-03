// Original official-artifact requirements. The observer only instruments the
// unchanged built product entry; it adds no product HTTP maintenance endpoint.
import test from 'node:test';
import assert from 'node:assert/strict';
import {cp,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {Miniflare,CorePaths} from 'miniflare';
import {sql} from 'kysely';
import {openD1} from '../../src/lib/server/database/d1.ts';
import {seedMaintenance,observeMaintenance} from '../helpers/revision-maintenance/hosting-fixture.ts';

async function fixture(directory:string) {
  await cp(resolve('build/cloudflare/worker/worker.js'),join(directory,'app.mjs'));
  await writeFile(join(directory,'observer.mjs'),`import app from './app.mjs';let anchors=0;
export default {
scheduled(controller,env,ctx){return app.scheduled(controller,env,{waitUntil(task){anchors++;ctx.waitUntil(task);},passThroughOnException(){ctx.passThroughOnException();}});},
fetch(request,env,ctx){if(new URL(request.url).pathname==='/__test_observer__')return Response.json({scheduled:typeof app.scheduled,anchors});return app.fetch(request,env,ctx);}
};`);
  const scriptPath=join(directory,'observer.mjs');
  // Miniflare's combined assets RPC proxy implements fetch/tail but does not
  // forward a scheduled event. Keep actual static assets in a separate worker
  // and service-bind them so the product receives the real event directly.
  return new Miniflare({unsafeTriggerHandlers:true,cf:false,host:'127.0.0.1',port:0,d1Persist:join(directory,'d1'),workers:[{
    name:'cms-revision-product',modulesRoot:dirname(scriptPath),modules:[{type:'ESModule',path:scriptPath},{type:'ESModule',path:join(directory,'app.mjs')}],
    compatibilityDate:'2026-05-07',compatibilityFlags:['nodejs_compat'],
    serviceBindings:{ASSETS:'cms-revision-assets'},d1Databases:{CMS_DB:'cms-official-revision-worker'},
    bindings:{CMS_PUBLIC_ORIGIN:'https://cms.example',SVELTERY_D1_SESSION:'auto',SVELTERY_D1_COALESCE:'true'}
  },{
    name:'cms-revision-assets',modules:true,script:'export default {fetch(request,env){return env.ASSETS.fetch(request);}};',
    compatibilityDate:'2026-05-07',assets:{directory:resolve('build/cloudflare/assets'),binding:'ASSETS',routerConfig:{has_user_worker:true,invoke_user_worker_ahead_of_assets:true}}
  }]});
}
async function observation(worker:Miniflare) {
  return (await worker.dispatchFetch('https://cms.example/__test_observer__')).json();
}
async function scheduled(worker:Miniflare) {
  return worker.dispatchFetch(`https://cms.example${CorePaths.SCHEDULED}?cron=*+*+*+*+*&time=1780272000000`);
}

test('official Cloudflare artifact registers real waitUntil revision cleanup with persistent raw D1 and reopen',{timeout:60_000},async()=>{
  const directory=await mkdtemp(join(tmpdir(),'cms-official-worker-revisions-'));
  let worker:Miniflare|undefined,operator:ReturnType<typeof openD1>|undefined;
  try {
    worker=await fixture(directory);await worker.ready;
    assert.deepEqual(await observation(worker),{scheduled:'function',anchors:0},'The actual official Worker artifact must register maintenance');
    operator=openD1(await worker.getD1Database('CMS_DB','cms-revision-product'));
    const protectedIds=await seedMaintenance(operator);
    const event=await scheduled(worker);
    assert.equal(event.status,200,await event.text());
    assert.deepEqual(await observation(worker),{scheduled:'function',anchors:1});
    await observeMaintenance(operator,protectedIds);
    assert.equal((await worker.dispatchFetch('https://cms.example/api/maintenance/revisions',{method:'POST'})).status,404);
    await operator.close();operator=undefined;await worker.dispose();
    worker=await fixture(directory);await worker.ready;
    operator=openD1(await worker.getD1Database('CMS_DB','cms-revision-product'));
    await observeMaintenance(operator,protectedIds);
    assert.equal((await scheduled(worker)).status,200);
    assert.deepEqual(await observation(worker),{scheduled:'function',anchors:1});
    await observeMaintenance(operator,protectedIds);
  }finally{await operator?.close();await worker?.dispose();await rm(directory,{recursive:true,force:true});}
});

test('official Cloudflare scheduled startup refusal reaches waitUntil and leaves real operator rows unchanged',{timeout:60_000},async()=>{
  const directory=await mkdtemp(join(tmpdir(),'cms-official-worker-revision-refusal-'));
  let worker:Miniflare|undefined,operator:ReturnType<typeof openD1>|undefined;
  try {
    worker=await fixture(directory);await worker.ready;
    assert.deepEqual(await observation(worker),{scheduled:'function',anchors:0},'The actual official Worker artifact must register maintenance');
    operator=openD1(await worker.getD1Database('CMS_DB','cms-revision-product'));
    await sql`CREATE TABLE _cms_operator_private(id INTEGER PRIMARY KEY,value TEXT NOT NULL)`.execute(operator.db);
    await sql`INSERT INTO _cms_operator_private VALUES(1,'preserved')`.execute(operator.db);
    assert.equal((await scheduled(worker)).status,500);
    assert.deepEqual(await observation(worker),{scheduled:'function',anchors:1});
    assert.deepEqual((await sql`SELECT * FROM _cms_operator_private`.execute(operator.db)).rows,[{id:1,value:'preserved'}]);
    assert.deepEqual((await sql`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '_cf_%' ORDER BY name`.execute(operator.db)).rows,[{name:'_cms_operator_private'}]);
    await operator.close();operator=undefined;await worker.dispose();
    worker=await fixture(directory);await worker.ready;operator=openD1(await worker.getD1Database('CMS_DB','cms-revision-product'));
    assert.deepEqual((await sql`SELECT * FROM _cms_operator_private`.execute(operator.db)).rows,[{id:1,value:'preserved'}]);
  }finally{await operator?.close();await worker?.dispose();await rm(directory,{recursive:true,force:true});}
});
