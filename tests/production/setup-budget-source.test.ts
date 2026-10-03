// @ts-nocheck -- immutable complete source callback; native built-HTTP fixture.
// EmDash1.1.0 MIT Copyright 2026 Cloudflare Inc.; notices/emdash-MIT.txt.
import {describe,beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {it,expect as baseExpect} from '../helpers/upstream-expect.ts';
import {schemaAdminRemotes} from '../helpers/schema-admin-remotes.ts';
import {OptionsRepository as StoredOptions} from '../../src/lib/server/settings/options.ts';
import {identityOptions} from '../../src/lib/server/auth/identity-store.ts';
import {useEmptySetupAuthority} from '../helpers/setup-first-run-authority.ts';
function expect(actual) {const result=baseExpect(actual);result.toBeLessThan=expected=>assert.ok(actual<expected);return result;}
const collections = ['menu_items','experiences','gallery_items','pages'];
const seed = {
 version:'1',settings:{},
 collections:collections.map(slug=>({slug,label:slug,fields:[{slug:'title',label:'Title',type:'string'},{slug:'body',label:'Body',type:'text'}]})),
 content:Object.fromEntries(collections.map(slug=>[slug,Array.from({length:28},(_,index)=>({id:`${slug}-${index}`,slug:`${slug}-${index}`,data:{title:`Entry ${index}`,body:`Body ${index}`}}))]))
};
class QueryCountingPlugin {
 count=0;
 transformQuery(args) {this.count+=1;return args.node;}
 transformResult(args) {return Promise.resolve(args.result);}
}
for (const target of ['Node','D1']) describe(`${target}: complete pinned setup budget callback`,()=>{
 let h,db,countedDb;
 beforeEach(async()=>{
  h=await schemaAdminRemotes(target,true,{configureRequest(event){
   if(countedDb) event.locals.cms={...event.locals.cms,database:{...h.database,db:countedDb}};
   event.locals.cmsRuntime={publicOrigin:'http://site.example',basePath:'',rpName:'Test'};
   event.locals.cmsSetupSeed=seed;
  }});await useEmptySetupAuthority(h.database);db=h.database.db;
 });
 afterEach(async()=>{await h.close();});
 class OptionsRepository extends StoredOptions {
  get(key){return key==='emdash:setup_state'||key==='emdash:setup_complete'?identityOptions(h.database).get(key):super.get(key);}
 }
 async function postSetupCounted(db) {
  const counter=new QueryCountingPlugin();countedDb=db.withPlugin(counter);
  const response=await h.request('/api/setup',null,{method:'POST',headers:{'content-type':'application/json',origin:'http://site.example'},body:JSON.stringify({title:'My Site',includeContent:true})});
  let body;try{body=await response.json();}catch{body={error:{code:'NOT_IMPLEMENTED'}};}
  countedDb=undefined;return {status:response.status,body,queries:counter.count};
 }
 async function countEntries(db) {
  let total=0;
  for(const table of ['ec_menu_items','ec_experiences','ec_gallery_items','ec_pages']) {
   const rows=await db.selectFrom(table).select(eb=>eb.fn.countAll().as('count')).executeTakeFirstOrThrow();total+=rows.count;
  }
  return total;
 }
	it("applies 112 entries over requests that each stay under 1,000 queries", async () => {
		const options = new OptionsRepository(db);
		const responses: Awaited<ReturnType<typeof postSetupCounted>>[] = [];
		const entriesAfter: number[] = [];
		let afterFirst: { siteUrl: unknown; setupState: unknown } | undefined;
		for (let request = 0; request < 20; request++) {
			const response = await postSetupCounted(db);
			responses.push(response);
			expect(response.status).toBe(200);
			entriesAfter.push(await countEntries(db));
			afterFirst ??= {
				siteUrl: await options.get("emdash:site_url"),
				setupState: await options.get("emdash:setup_state"),
			};
			if (response.body.data.seedComplete) break;
		}

		expect(Math.max(...responses.map((response) => response.queries))).toBeLessThan(1000);
		expect(responses.length).toBeGreaterThan(1);
		expect(responses.at(-1)?.body.data.seedComplete).toBe(true);
		expect(afterFirst).toEqual({ siteUrl: "http://site.example", setupState: null });

		const progress = responses.slice(0, -1).map((response) => response.body.data.seedProgress);
		expect(progress.every((step) => step?.total === 112)).toBe(true);
		const done = progress.map((step) => step?.done);
		expect(done).toEqual(entriesAfter.slice(0, -1));
		expect(new Set(done).size).toBe(done.length);

		expect(entriesAfter.at(-1)).toBe(112);
		expect(await options.get("emdash:setup_state")).toMatchObject({ step: "site_complete" });
	});
});
