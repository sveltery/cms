// @ts-nocheck -- complete unchanged source callbacks with native path/auth fixture.
// EmDash1.1.0 MIT2026 Cloudflare Inc.; notices/emdash-MIT.txt.
import {test as base,expect} from '@playwright/test';
import {passkeyRuntime} from '../helpers/passkey-runtime';
import {webauthnCredential} from '../helpers/webauthn-credential';
const ADMIN_DASHBOARD_PATTERN=/\/dashboard\/?$/;
const PASSKEY_ACTION_REGEX=/^(Create passkey|Use another device|Use a security key)$/;
const test=base.extend({admin:async({page},use)=>{
 const h=await passkeyRuntime('Node');page.setDefaultTimeout(3_000);
 try{
  await use({page,goto:path=>page.goto(h.origin+path),goToSetup:()=>page.goto(h.origin+'/setup'),expectSetupPage:()=>expect(page).toHaveURL(h.origin+'/setup'),
   async devBypassAuth(){
    // Source fixture bypass becomes ordinary signed registration and login;
    // no test identity/role endpoint is installed in the product.
    const credential=webauthnCredential(h.origin);
    const post=(path,body)=>page.request.post(h.origin+path,{headers:{origin:h.origin},data:body});
    let response=await post('/api/setup/admin',{email:'fixture@example.com',name:'Fixture User'});
    expect(response.status()).toBe(200);let body=await response.json();
    response=await post('/api/setup/admin/verify',{credential:credential.registration(body.data.options.challenge)});expect(response.status()).toBe(200);
    response=await post('/api/auth/passkey/options',{});expect(response.status()).toBe(200);body=await response.json();
    response=await post('/api/auth/passkey/verify',{credential:credential.assertion(body.data.options.challenge)});expect(response.status()).toBe(200);
   }
  });
 }finally{await h.close();}
}});
test.beforeEach(()=>test.setTimeout(20_000));
test.describe('Complete pinned setup wizard callbacks: native adapter',()=>{
	test("redirects to setup wizard when database is empty", async ({ admin }) => {
		await admin.goto("/");
		await admin.expectSetupPage();
	});

	test("displays site step with form fields", async ({ admin }) => {
		await admin.goToSetup();

		await expect(admin.page.locator("text=Set up your site")).toBeVisible();
		await expect(admin.page.getByLabel("Site Title")).toBeVisible();
		await expect(admin.page.getByLabel("Tagline")).toBeVisible();
		await expect(admin.page.getByRole("button", { name: "Continue" })).toBeVisible();
	});

	test("shows validation error when title is empty", async ({ admin }) => {
		await admin.goToSetup();

		await admin.page.getByLabel("Site Title").fill("");
		await admin.page.getByRole("button", { name: "Continue" }).click();

		await expect(admin.page.locator("text=Site title is required")).toBeVisible();
	});

	test("advances to admin step after filling site info", async ({ admin }) => {
		await admin.goToSetup();

		await admin.page.getByLabel("Site Title").fill("My Test Site");
		await admin.page.getByLabel("Tagline").fill("A site for testing");
		await admin.page.getByRole("button", { name: "Continue" }).click();

		await expect(admin.page.locator("text=Create your account")).toBeVisible();
		await expect(admin.page.getByLabel("Your Email")).toBeVisible();
		await expect(admin.page.getByLabel("Your Name")).toBeVisible();
	});

	test("advances to passkey step after filling admin info", async ({ admin }) => {
		await admin.goToSetup();

		// Complete site step
		await admin.page.getByLabel("Site Title").fill("My Test Site");
		await admin.page.getByRole("button", { name: "Continue" }).click();
		await expect(admin.page.locator("text=Create your account")).toBeVisible();

		// Complete admin step
		await admin.page.getByLabel("Your Email").fill("test@example.com");
		await admin.page.getByLabel("Your Name").fill("Test User");
		await admin.page.getByRole("button", { name: "Continue" }).click();

		await expect(admin.page.locator("text=Secure your account")).toBeVisible();
		await expect(
			admin.page.getByRole("heading", {
				name: "With a passkey, you don’t need to remember complex passwords",
			}),
		).toBeVisible();
		await expect(
			admin.page.getByRole("button", { name: PASSKEY_ACTION_REGEX }).first(),
		).toBeVisible();
	});

	test("setup wizard not accessible after setup complete", async ({ admin }) => {
		// Complete setup and authenticate via dev-bypass through the browser
		await admin.devBypassAuth();

		await admin.goToSetup();

		// Should redirect to dashboard (setup already complete)
		await admin.page.waitForURL(ADMIN_DASHBOARD_PATTERN, { timeout: 10000 });
	});
});
