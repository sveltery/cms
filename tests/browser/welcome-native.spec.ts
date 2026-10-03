import {test,expect} from '@playwright/test';
import {passkeyRuntime} from '../helpers/passkey-runtime';
import {webauthnCredential} from '../helpers/webauthn-credential';

// Original native acceptance: actual standard setup, signed credential/session,
// trusted profile projection and persisted dismissal. Zero copied-source credit.
test('native welcome heading and dismissal survive ordinary setup and restart',async({page})=>{
 const h=await passkeyRuntime('Node');
 try{
  const credential=webauthnCredential(h.origin);
  const post=(path:string,body:unknown)=>page.request.post(h.origin+path,{headers:{origin:h.origin},data:body});
  let response=await post('/api/setup',{title:'Welcome acceptance',tagline:'Persisted setup',includeContent:true});expect(response.status()).toBe(200);
  response=await post('/api/setup/admin',{email:'welcome-native@example.com',name:'Welcome Reader'});expect(response.status()).toBe(200);let body=await response.json();
  response=await post('/api/setup/admin/verify',{credential:credential.registration(body.data.options.challenge)});expect(response.status()).toBe(200);
  response=await post('/api/auth/passkey/options',{});expect(response.status()).toBe(200);body=await response.json();
  response=await post('/api/auth/passkey/verify',{credential:credential.assertion(body.data.options.challenge)});expect(response.status()).toBe(200);
  await page.goto(h.origin+'/dashboard');
  const title=page.getByRole('heading',{name:'Welcome to EmDash, Welcome!',exact:true});
  // Default5s expectation finishes inside the existing30s whole-test limit.
  await expect(title).toBeVisible();
  await expect(page.getByText('Administrator',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Get Started',exact:true}).click();
  await expect(title).not.toBeVisible();
  response=await page.request.get(h.origin+'/api/auth/me');expect(response.status()).toBe(200);body=await response.json();expect(body.data.isFirstLogin).toBe(false);
  await h.restart();await page.goto(h.origin+'/dashboard');
  await expect(page.locator('[data-native-dashboard=true]')).toBeVisible();
  await expect(title).not.toBeVisible();
  response=await page.request.get(h.origin+'/api/auth/me');expect(response.status()).toBe(200);body=await response.json();expect(body.data.isFirstLogin).toBe(false);expect(body.data.role).toBe(50);expect(body.data.data).toBeUndefined();
 }finally{await h.close();}
});
