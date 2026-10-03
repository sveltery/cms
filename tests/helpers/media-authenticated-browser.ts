// Shared ordinary product acceptance fixture; no source auth bypass or identity seed.
import {test as base,expect,type Page} from '@playwright/test';
import {passkeyRuntime} from './passkey-runtime';
import {addVirtualWebAuthnAuthenticator} from './virtual-authenticator';
import {completeFullSetup} from './full-setup-browser';
type MediaAdmin={page:Page;goToMedia:()=>Promise<unknown>;waitForLoading:()=>Promise<void>;expectPageTitle:(title:string)=>Promise<void>};
export const test=base.extend<{admin:MediaAdmin}>({admin:async({page,context},use)=>{
 const h=await passkeyRuntime('Node');const removeAuthenticator=await addVirtualWebAuthnAuthenticator(page);
 try{await page.goto(h.origin+'/setup');await completeFullSetup(page,'media@example.com','Media Admin');
 await page.getByRole('button',{name:'Sign in with a passkey',exact:true}).click();
 await expect(page).toHaveURL(h.origin+'/');
 const current=await page.request.get(h.origin+'/api/auth/me');expect(current.status()).toBe(200);expect((await current.json()).data.role).toBe(50);
 await page.waitForLoadState('networkidle');
 const welcome=page.getByRole('heading',{name:/^Welcome to EmDash/});if(await welcome.isVisible())await page.getByRole('button',{name:'Get Started',exact:true}).click();
 await use({page,goToMedia:()=>page.goto(h.origin+'/media'),waitForLoading:()=>page.waitForLoadState('networkidle'),expectPageTitle:title=>expect(page.getByRole('heading',{name:title,exact:true})).toBeVisible()});
 }finally{await removeAuthenticator();await h.close();}
}});
export {expect};
