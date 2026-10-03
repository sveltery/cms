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
    serviceBindings:{ASSETS:'cms-revision-assets'},d1Databases:{MAINTENANCE_DB:'cms-official-revision-worker'},
    bindings:{SVELTERY_D1_BINDING:'MAINTENANCE_DB',CMS_PUBLIC_ORIGIN:'https://cms.example',SVELTERY_D1_SESSION:'auto',SVELTERY_D1_COALESCE:'true'}
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

test('official Worker maintenance uses the same trusted custom D1 binding as request hosting',{timeout:60_000},async()=>{
  const directory=await mkdtemp(join(tmpdir(),'cms-official-worker-custom-binding-'));
  let worker:Miniflare|undefined,operator:ReturnType<typeof openD1>|undefined;
  try {
    worker=await fixture(directory);await worker.ready;
    assert.deepEqual(await observation(worker),{scheduled:'function',anchors:0});
    operator=openD1(await worker.getD1Database('MAINTENANCE_DB','cms-revision-product'));
    const protectedIds=await seedMaintenance(operator);
    const event=await scheduled(worker);
    assert.equal(event.status,200,await event.text());
    assert.deepEqual(await observation(worker),{scheduled:'function',anchors:1});
    await observeMaintenance(operator,protectedIds);
    await operator.close();operator=undefined;await worker.dispose();
    worker=await fixture(directory);await worker.ready;
    operator=openD1(await worker.getD1Database('MAINTENANCE_DB','cms-revision-product'));
    await observeMaintenance(operator,protectedIds);
  }finally{await operator?.close();await worker?.dispose();await rm(directory,{recursive:true,force:true});}
});
