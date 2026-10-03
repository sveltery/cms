import {expect,type Page} from '@playwright/test';
/** Native fixture follows the actual full wizard; no product bypass or seeded identity. */
export async function completeFullSetup(page:Page,email:string,name=''){
 await page.getByLabel('Site Title').fill('Passkey Test Site');
 await page.getByRole('button',{name:'Continue',exact:true}).click();
 await expect(page.getByLabel('Your Email')).toBeVisible();await page.getByLabel('Your Email').fill(email);
 if(name)await page.getByLabel('Your Name',{exact:true}).fill(name);
 await page.getByRole('button',{name:'Continue',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Secure your account',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Create passkey',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Your account is ready',exact:true})).toBeVisible({timeout:30_000});
 await page.getByRole('link',{name:'Open the dashboard',exact:true}).click();
}
/** Ordinary first-login UI consumes the actual persisted welcome mutation. */
export async function dismissFirstWelcome(page:Page){
 const heading=page.getByRole('heading',{name:/^Welcome to EmDash/});
 await expect(heading).toBeVisible();
 await page.getByRole('button',{name:'Get Started',exact:true}).click();
 await expect(heading).not.toBeVisible();
}
