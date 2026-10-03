import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sql, type Kysely } from 'kysely';
import { installRedirectTables } from '../src/lib/server/redirects/migrations/index.ts';
import type { RequestEvent } from '@sveltejs/kit';
import { createCmsRuntime } from '../src/lib/server/runtime/composition.ts';

function request(path: string): RequestEvent {
  const url = new URL(path, 'http://cms.test');
  return { request: new Request(url), url, locals: {}, cookies: {get:()=>undefined}, platform: undefined } as unknown as RequestEvent;
}

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'cms-redirect-native-'));
  const deferred: Promise<void>[] = [];
  const runtime = createCmsRuntime(() => ({kind:'sqlite',path:join(directory,'data.db'),publicOrigin:'http://cms.test',keepAlive:task=>deferred.push(task)}));
  const initial = request('/');
  await runtime.handle({event:initial,resolve:async()=>new Response('ok')});
  const database = initial.locals.cms!.database;
  // Explicit native test fixture, never a registered application migration.
  await installRedirectTables(database.db as unknown as Kysely<unknown>);
  return {runtime,database,deferred,async close(){await Promise.allSettled(deferred);await runtime.close();await rm(directory,{recursive:true,force:true});}};
}

for (const [title, source, destination, type, isPattern, requested] of [
 ['public exact redirect precedes the page resolver','/old','/new',308,0,'/old'],
 ['public pattern redirects preserve captured paths','/old/[...path]','/new/[...path]',301,1,'/old/a/b'],
 ['terminal rules return Gone without a Location header','/deleted','',410,0,'/deleted']
] as const) {
 test(title, async()=>{
  const f=await fixture();
  try {
   await sql`INSERT INTO _cms_redirects (id,source,destination,type,is_pattern,created_at,updated_at)
     VALUES ('rule',${source},${destination},${type},${isPattern},'2026-01-01T00:00:00Z','2026-01-01T00:00:00Z')`.execute(f.database.db);
   let pageResolutions=0;
   const response=await f.runtime.handle({event:request(requested),resolve:async()=>{pageResolutions++;return new Response('page');}});
   assert.equal(response.status,type);
   assert.equal(response.headers.get('Location'), type===410?null:isPattern?'/new/a/b':destination);
   assert.equal(pageResolutions,0);
  } finally {await f.close();}
 });
}

test('public misses create a persisted deduplicated 404 log without changing the response',async()=>{
 const f=await fixture();
 try {
  for(let i=0;i<2;i++) {
   const response=await f.runtime.handle({event:request('/missing'),resolve:async()=>new Response('missing',{status:404})});
   assert.equal(response.status,404);
   await Promise.allSettled(f.deferred);
  }
  const rows=await sql<{path:string;hits:number}>`SELECT path,hits FROM _cms_404_log`.execute(f.database.db);
  assert.deepEqual(rows.rows.map(row=>({...row})),[{path:'/missing',hits:2}]);
 } finally {await f.close();}
});
