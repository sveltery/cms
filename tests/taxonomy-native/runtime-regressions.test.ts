// Supplemental Native regressions for audited Source contracts, not new Source
// matcher inventory or protected HTTP/auth probes. Original Source7 remains whole.
// EmDash pin913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; MIT notices/emdash-MIT.txt.
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import type {CmsDatabase} from '../../src/lib/server/database/contract.ts';
import type {ServerPrincipal} from '../../src/lib/server/database/service.ts';
import {openSqlite} from '../../src/lib/server/database/sqlite.ts';
import {migrateCms} from '../../src/lib/server/database/migrations.ts';
import {SchemaRegistry} from '../../src/lib/server/database/registry.ts';
import {canonicalSourceDatabase} from '../../src/lib/server/canonical-storage/namespace.ts';
import {TaxonomyRepository} from '../../src/lib/server/taxonomies/repository.ts';
import {setI18nConfig} from '../../src/lib/server/menus/i18n-config.ts';
import {handleContentCreate,handleContentUpdate,nativeTaxonomyContentHost} from '../../src/lib/server/taxonomies/content.ts';

const controlled=vi.hoisted(()=>({storage:null as CmsDatabase|null,db:null as ReturnType<typeof canonicalSourceDatabase>|null}));
// Original controlled unit-context substitution: only the taxonomy route's
// body/query behavior runs. Existing identity/session/origin checks are not probed.
vi.mock('../../src/lib/server/taxonomies/http.ts',()=>({
 withTaxonomyRequest:(_event:unknown,_mutation:unknown,_permissions:unknown,_code:unknown,_message:unknown,run:(db:unknown,storage:unknown)=>unknown)=>run(controlled.db,controlled.storage)
}));
import {POST as reorder} from '../../src/routes/api/taxonomies/[name]/reorder/+server.ts';
const principal:ServerPrincipal={id:'taxonomy-content-fixture',permissions:['content:create','content:read','content:read_drafts','content:edit_any']};
let storage:CmsDatabase;let repository:TaxonomyRepository;
let host:ReturnType<typeof nativeTaxonomyContentHost>;
beforeEach(async()=>{
 storage=openSqlite(':memory:');await migrateCms(storage);
 const registry=new SchemaRegistry(storage);
 await registry.createCollection({slug:'post',label:'Posts',labelSingular:'Post'});
 await registry.createField('post',{slug:'title',label:'Title',type:'string'});
 controlled.storage=storage;controlled.db=canonicalSourceDatabase(storage);
 repository=new TaxonomyRepository(controlled.db);host=nativeTaxonomyContentHost(controlled.db,storage,principal);
});
afterEach(async()=>{setI18nConfig(null);controlled.storage=null;controlled.db=null;await storage?.close();});

it('TAXRUNREV01: reorder ignores malformed locale query and persists the requested positions',async()=>{
 // Whole pinned Source api/routes/taxonomies/reorder.ts explicitly ignores locale.
 const first=await repository.create({name:'category',slug:'first',label:'First'});
 const second=await repository.create({name:'category',slug:'second',label:'Second'});
 const url=new URL('http://taxonomy.local/api/taxonomies/category/reorder?locale=invalid_locale!');
 const response=await reorder({url,params:{name:'category'},request:new Request(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({ids:[second.id,first.id]})}),locals:{}} as Parameters<typeof reorder>[0]);
 expect(response.status).toBe(200);
 expect((await repository.findByName('category',{locale:'en'})).map(term=>term.id)).toEqual([second.id,first.id]);
});

it('TAXRUNREV02: configured locale casing resolves the real French term and persists fr content',async()=>{
 // Pinned Source content.ts1272 canonicalizes explicit locale before slug lookup.
 setI18nConfig({defaultLocale:'en',locales:['en','fr']});
 const term=await repository.create({name:'tag',slug:'actualites',label:'Actualités',locale:'fr'});
 const result=await handleContentCreate(controlled.db!,'post',{data:{title:'Bonjour'},locale:'FR',taxonomies:{tag:['actualites']}},host);
 expect(result.success).toBe(true);
 if(!result.success)throw new Error(result.error.message);
 expect(result.data.item.locale).toBe('fr');
 expect((await repository.getTermsForEntry('post',result.data.item.id,'tag','fr')).map(value=>value.id)).toEqual([term.id]);
});

it('TAXRUNREV03: omitted-locale update resolves the existing French entry and replaces actual terms',async()=>{
 // Pinned Source content.ts1496/1643–1648 uses the existing/updated entry locale.
 setI18nConfig({defaultLocale:'en',locales:['en','fr']});
 await repository.create({name:'tag',slug:'initial',label:'Initial',locale:'fr'});
 const replacement=await repository.create({name:'tag',slug:'suivant',label:'Suivant',locale:'fr'});
 const created=await handleContentCreate(controlled.db!,'post',{data:{title:'Français'},locale:'fr',taxonomies:{tag:['initial']}},host);
 expect(created.success).toBe(true);if(!created.success)throw new Error(created.error.message);
 const result=await handleContentUpdate(controlled.db!,'post',created.data.item.id,{taxonomies:{tag:['suivant']}},host);
 expect(result.success).toBe(true);if(!result.success)throw new Error(result.error.message);
 expect(result.data.item.locale).toBe('fr');
 expect(result.data.item.version).toBeGreaterThan(created.data.item.version);
 expect((await repository.getTermsForEntry('post',result.data.item.id,'tag','fr')).map(value=>value.id)).toEqual([replacement.id]);
});
