// Original full native product composition; no duplicate auth/source credit.
import test from 'node:test';
import assert from 'node:assert/strict';
import {passkeyRuntime} from '../helpers/passkey-runtime.ts';
import {webauthnCredential} from '../helpers/webauthn-credential.ts';
import {OptionsRepository} from '../../src/lib/server/settings/options.ts';
for(const target of ['Node','D1'] as const)test(`${target}: real native site form precedes passkey setup and completion redirects to a persistent dashboard`,{timeout:60_000},async()=>{
 const h=await passkeyRuntime(target),browser=h.browser();
 try{
  const initial=await h.request('/',{redirect:'manual'});assert.equal(initial.status,303);assert.equal(initial.headers.get('location'),'/setup');
  const html=await (await browser.get('/setup')).text();assert.match(html,/Set up your site/);
  const action=[...html.matchAll(/<form[^>]*action="([^"]+)"[^>]*>/g)].map(match=>match[1]).find(value=>value.includes('/setupSiteConfiguration'));assert.ok(action,'actual registered site form');
  const url=new URL(action.replaceAll('&amp;','&'),h.origin);
  const seeded=await browser.submitNative(url.pathname+url.search,new URLSearchParams({title:'Native Site',tagline:'Persistent setup'}));assert.equal(seeded.status,303);
  let database=await h.database(),options=new OptionsRepository(database.db as any);assert.equal(await options.get('site:title'),'Native Site');assert.equal(await options.get('site:tagline'),'Persistent setup');
  const credential=webauthnCredential(h.origin);
  let response=await browser.post('/api/setup/admin',{email:'native@example.com',name:'Native Admin'});assert.equal(response.status,200);let body=await response.json();
  response=await browser.post('/api/setup/admin/verify',{credential:credential.registration(body.data.options.challenge)});assert.equal(response.status,200);
  assert.equal(await options.get('site:title'),'Native Site');assert.equal(await options.get('site:tagline'),'Persistent setup');
  response=await browser.post('/api/auth/passkey/options',{});assert.equal(response.status,200);body=await response.json();
  response=await browser.post('/api/auth/passkey/verify',{credential:credential.assertion(body.data.options.challenge)});assert.equal(response.status,200);
  const completed=await h.request('/setup',{headers:{cookie:[...browser.cookies].map(([key,value])=>`${key}=${value}`).join('; ')},redirect:'manual'});assert.equal(completed.status,303);assert.equal(completed.headers.get('location'),'/dashboard');
  const dashboard=await browser.get('/dashboard');assert.equal(dashboard.status,200);const dashboardHtml=await dashboard.text();assert.match(dashboardHtml,/Posts/);assert.match(dashboardHtml,/Pages/);assert.match(dashboardHtml,/1 users/);
  await h.restart();database=await h.database();options=new OptionsRepository(database.db as any);assert.equal(await options.get('site:title'),'Native Site');assert.equal((await browser.get('/dashboard')).status,200);
 }finally{await h.close();}
});
