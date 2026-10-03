// Original bounded capability checks; zero complete applySeed/source-test credit.
import test from 'node:test';
import assert from 'node:assert/strict';
import {sql} from 'kysely';
import {schemaAdminRemotes} from '../helpers/schema-admin-remotes.ts';
import {useEmptySetupAuthority} from '../helpers/setup-first-run-authority.ts';
import type {CmsDatabase} from '../../src/lib/server/database/contract.ts';
import type {SeedFile} from '../../src/lib/server/setup/upstream/types.ts';

async function snapshot(database:CmsDatabase){
 const objects=(await sql<{name:string;type:string}>`SELECT name,type,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND name!='_cf_METADATA' ORDER BY name`.execute(database.db)).rows;
 const rows=[];
 for(const object of objects.filter(object=>object.type==='table'))rows.push({table:object.name,rows:(await sql`SELECT * FROM ${sql.table(object.name)}`.execute(database.db)).rows});
 return {objects,rows};
}
const media={$media:{url:'https://example.com/seed-image.jpg',alt:'Seed image'}};
const variants=[
 {name:'nonempty taxonomy terms',terms:true},
 {name:'top-level source media directive',payload:media},
 {name:'media directive in a nested array/object',payload:{gallery:[{asset:media}]}},
] as const;
function seedFor(variant:typeof variants[number]):SeedFile{
 return {version:'1',settings:{title:'Must not write'},
  collections:[{slug:'capability_entries',label:'Capability entries',routable:false,supports:[],fields:[{slug:'title',label:'Title',type:'string'},{slug:'payload',label:'Payload',type:'text'}]}],
  ...('terms' in variant?{taxonomies:[{name:'capability_terms',label:'Capability terms',hierarchical:false,collections:['capability_entries'],terms:[{id:'term-one',slug:'term-one',label:'Term one'}]}]}:
   {content:{capability_entries:[{id:'capability-entry',data:{title:'Sample',payload:variant.payload}}]}})};
}
async function fixture(target:'Node'|'D1',seed:SeedFile){
 const h=await schemaAdminRemotes(target,true,{configureRequest(event){event.locals.cmsRuntime={publicOrigin:h.origin,basePath:'',rpName:'Test'};event.locals.cmsSetupSeed=seed;}});
 await useEmptySetupAuthority(h.database);return h;
}
for(const target of ['Node','D1'] as const){
 for(const variant of variants)test(`${target}: requested unsupported ${variant.name} rejects without any seed/options/schema writes`,async()=>{
  const h=await fixture(target,seedFor(variant));
  try{
   const before=await snapshot(h.database);
   const response=await h.request('/api/setup',null,{method:'POST',headers:{origin:h.origin,'content-type':'application/json'},body:JSON.stringify({title:'Requested setup',includeContent:true})});
   const body=await response.json();
   // This full persisted-state assertion reaches the actual silent writes in
   // the red baseline, independently of the subsequent bounded error checks.
   assert.deepEqual(await snapshot(h.database),before);
   assert.equal(response.status,400);assert.equal(body.error.code,'UNSUPPORTED_SEED');
   assert.equal(body.data,undefined);
  }finally{await h.close();}
 });
 test(`${target}: includeContent=false preserves source ignored terms/media sample behavior`,async()=>{
  const seed=seedFor(variants[0]);seed.content=seedFor(variants[2]).content;
  const h=await fixture(target,seed);
  try{
   const response=await h.request('/api/setup',null,{method:'POST',headers:{origin:h.origin,'content-type':'application/json'},body:JSON.stringify({title:'Schema only',includeContent:false})});
   assert.equal(response.status,200);const body=await response.json();assert.equal(body.data.seedComplete,true);assert.equal(body.data.result.taxonomies.terms,0);assert.equal(body.data.result.content.created,0);
   assert.deepEqual((await sql`SELECT * FROM ec_capability_entries`.execute(h.database.db)).rows,[]);
  }finally{await h.close();}
 });
 test(`${target}: unrecognized media-shaped ordinary JSON remains ordinary content`,async()=>{
  const payload={$media:{url:123},nested:[{$media:'plain JSON'}]};
  const seed=seedFor(variants[1]);seed.content!.capability_entries[0].data.payload=payload;
  const h=await fixture(target,seed);
  try{
   const response=await h.request('/api/setup',null,{method:'POST',headers:{origin:h.origin,'content-type':'application/json'},body:JSON.stringify({title:'Ordinary JSON',includeContent:true})});
   assert.equal(response.status,200);assert.equal((await response.json()).data.seedComplete,true);
   const rows=(await sql<{payload:string}>`SELECT payload FROM ec_capability_entries`.execute(h.database.db)).rows;assert.equal(rows.length,1);assert.deepEqual(JSON.parse(rows[0].payload),payload);
  }finally{await h.close();}
 });
}
