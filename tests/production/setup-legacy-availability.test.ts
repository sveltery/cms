// Original native wizard availability boundary; zero copied-source credit.
import test from 'node:test';
import assert from 'node:assert/strict';
import {sql} from 'kysely';
import {passkeyRuntime} from '../helpers/passkey-runtime.ts';
import {identityOptions} from '../../src/lib/server/auth/identity-store.ts';
import {webauthnCredential} from '../helpers/webauthn-credential.ts';
import type {CmsDatabase} from '../../src/lib/server/database/contract.ts';

async function snapshot(database:CmsDatabase){
 const objects=(await sql<{name:string;type:string;sql:string|null}>`SELECT name,type,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND name!='_cf_METADATA' ORDER BY name`.execute(database.db)).rows;
 const rows=[];
 for(const object of objects.filter(object=>object.type==='table'))rows.push({table:object.name,rows:(await sql`SELECT * FROM ${sql.table(object.name)}`.execute(database.db)).rows});
 return {objects,rows};
}
async function fixture(target:'Node'|'D1',mixed=false){
 const h=await passkeyRuntime(target),browser=h.browser();
 try{
  assert.equal((await browser.get('/api/setup/status')).status,200);
  if(mixed){
   const credential=webauthnCredential(h.origin);
   const start=await browser.post('/api/setup/admin',{email:'enrolled-legacy-wizard@example.com'});assert.equal(start.status,200);
   const body=await start.json();assert.equal((await browser.post('/api/setup/admin/verify',{credential:credential.registration(body.data.options.challenge)})).status,200);
  }
  const database=await h.database();
  await database.db.insertInto('_cms_auth_users').values({id:'historical-wizard-user',role:50,disabled:0}).execute();
  if(!mixed)await identityOptions(database).delete('emdash:setup_complete');
  assert.deepEqual((await browser.query('getSiteSetup')).data,{needsSetup:false,unavailable:true,reason:'LEGACY_IDENTITY_UNAVAILABLE',seedInfo:null});
  return {h,browser,database};
 }catch(cause){await h.close();throw cause;}
}
for(const target of ['Node','D1'] as const){
 test(`${target}: profileless legacy site JSON mutation rejects before setup writes`,async()=>{
  const {h,browser,database}=await fixture(target);
  try{
   const before=await snapshot(database);
   const response=await browser.post('/api/setup',{title:'Must not seed',includeContent:true});
   assert.equal(response.status,503);assert.equal((await response.json()).error.code,'LEGACY_IDENTITY_UNAVAILABLE');
   assert.deepEqual(await snapshot(database),before);
  }finally{await h.close();}
 });
 test(`${target}: direct site mutation cannot write options, schema or seed rows for legacy users`,async()=>{
  const {h,browser,database}=await fixture(target);
  try{
   const before=await snapshot(database);
   await browser.post('/api/setup',{title:'Must not seed',includeContent:true});
   assert.deepEqual(await snapshot(database),before);
  }finally{await h.close();}
 });
 test(`${target}: native registered site form rejects mixed legacy authority before writes`,async()=>{
  const {h,browser,database}=await fixture(target,true);
  try{
   const before=await snapshot(database);
   const response=await browser.submitNative(`/setup?/remote=${h.ids.setupSiteConfiguration}`,new URLSearchParams({title:'Must not write',tagline:'Blocked'}));
   assert.equal(response.status,503);assert.match(await response.text(),/LEGACY_IDENTITY_UNAVAILABLE/);
   assert.deepEqual(await snapshot(database),before);
  }finally{await h.close();}
 });
 test(`${target}: full wizard displays legacy unavailability without any site or identity form`,async()=>{
  const {h,database}=await fixture(target);
  try{
   const before=await snapshot(database);
   const response=await h.request('/setup',{redirect:'manual'});assert.equal(response.status,200);
   const html=await response.text();assert.match(html,/Passkey authentication is unavailable for existing accounts/);
   assert.doesNotMatch(html,/<form\b/);assert.doesNotMatch(html,/Create passkey|Site Title|Your Email/);
   assert.deepEqual(await snapshot(database),before);
  }finally{await h.close();}
 });
}
