// @ts-nocheck -- immutable complete source callbacks with native host/auth adapter.
// EmDash1.1.0 MIT Copyright2026 Cloudflare Inc.; notices/emdash-MIT.txt.
import {test as base,expect} from '@playwright/test';
import {schemaAdminRemotes} from '../helpers/schema-admin-remotes';
const SETTINGS_API_PATTERN=/\/remote\/[^?]+\/updateSiteSettings(?:\?|$)/;
const test=base.extend({admin:async({page},use)=>{
 const h=await schemaAdminRemotes('Node');
 try{
  await page.context().addCookies([{name:'cms-session',value:h.tokens.admin,url:h.origin}]);
  await use({page,goto:path=>page.goto(h.origin+path),waitForShell:async()=>{},waitForLoading:async()=>{}});
 }finally{await h.close();}
}});
test.beforeEach(()=>test.setTimeout(20_000));
test.describe('Social Settings',()=>{
	test("page renders with heading and form", async ({ admin, page }) => {
		await admin.goto("/settings/social");
		await admin.waitForShell();
		await admin.waitForLoading();

		// Page heading
		await expect(page.locator("h1")).toContainText("Social Links");

		// Should show the social profiles section
		await expect(page.locator("text=Social Profiles")).toBeVisible({ timeout: 10000 });
	});
	test("displays all social input fields", async ({ admin, page }) => {
		await admin.goto("/settings/social");
		await admin.waitForShell();
		await admin.waitForLoading();

		// Each social field should have a visible input with its label
		for (const label of ["Twitter", "GitHub", "Facebook", "Instagram", "LinkedIn", "YouTube"]) {
			await expect(page.locator(`label:has-text("${label}")`)).toBeVisible({ timeout: 5000 });
		}

		await expect(page.getByRole("button", { name: "Saved", exact: true }).first()).toBeVisible();
	});
	test("saves a social link and persists across reload", async ({ admin, page }) => {
		await admin.goto("/settings/social");
		await admin.waitForShell();
		await admin.waitForLoading();

		const testHandle = `@e2e-test-${Date.now()}`;

		// Fill the first social input field (Twitter)
		const firstInput = page.locator("form input").first();
		await firstInput.fill(testHandle);

		// Wait for the save response
		const saveResponse = page.waitForResponse(
			(res) =>
				SETTINGS_API_PATTERN.test(res.url()) &&
				res.request().method() === "POST" &&
				res.status() === 200,
			{ timeout: 15000 },
		);

		await page.getByRole("button", { name: "Save", exact: true }).first().click();
		await saveResponse;

		// Success banner should appear
		await expect(page.locator("text=Social links saved")).toBeVisible({ timeout: 5000 });

		// Reload the page
		await admin.goto("/settings/social");
		await admin.waitForShell();
		await admin.waitForLoading();

		// The value should persist
		const firstInputAfterReload = page.locator("form input").first();
		await expect(firstInputAfterReload).toHaveValue(testHandle, { timeout: 10000 });
	});
});
test.describe('SEO Settings',()=>{
	test("page renders with heading and form", async ({ admin, page }) => {
		await admin.goto("/settings/seo");
		await admin.waitForShell();
		await admin.waitForLoading();

		// Page heading
		await expect(page.locator("h1")).toContainText("SEO Settings");

		// Should show the SEO section
		await expect(
			page.getByRole("heading", { name: "Search Engine Optimization", exact: true }),
		).toBeVisible({ timeout: 10000 });
	});
	test("displays expected SEO fields", async ({ admin, page }) => {
		await admin.goto("/settings/seo");
		await admin.waitForShell();
		await admin.waitForLoading();

		for (const label of [
			"Title Separator",
			"Google Verification",
			"Bing Verification",
			"robots.txt",
		]) {
			await expect(page.getByRole("textbox", { name: label, exact: true })).toBeVisible({
				timeout: 5000,
			});
		}

		await expect(page.getByRole("button", { name: "Saved", exact: true }).first()).toBeVisible();
	});
	test("saves SEO settings and persists across reload", async ({ admin, page }) => {
		await admin.goto("/settings/seo");
		await admin.waitForShell();
		await admin.waitForLoading();

		const testVerification = `e2e-verify-${Date.now()}`;

		// Fill the Google Verification field
		const googleInput = page.getByRole("textbox", {
			name: "Google Verification",
			exact: true,
		});
		await googleInput.fill(testVerification);

		// Wait for save response
		const saveResponse = page.waitForResponse(
			(res) =>
				SETTINGS_API_PATTERN.test(res.url()) &&
				res.request().method() === "POST" &&
				res.status() === 200,
			{ timeout: 15000 },
		);

		await page.getByRole("button", { name: "Save", exact: true }).first().click();
		await saveResponse;

		// Success banner
		await expect(page.locator("text=SEO settings saved")).toBeVisible({ timeout: 5000 });

		// Reload
		await admin.goto("/settings/seo");
		await admin.waitForShell();
		await admin.waitForLoading();

		// Value should persist
		const googleInputAfterReload = page.getByRole("textbox", {
			name: "Google Verification",
			exact: true,
		});
		await expect(googleInputAfterReload).toHaveValue(testVerification, { timeout: 10000 });
	});
});
test.describe('Form Data Loss Prevention',()=>{
	test("settings edits survive window blur/focus", async ({ admin, page }) => {
		await admin.goto("/settings/general");
		await admin.waitForShell();
		await admin.waitForLoading();

		// Edit the tagline field
		const taglineInput = page.getByLabel("Tagline");
		await taglineInput.fill("My edited tagline");

		// Simulate window blur + focus (triggers React Query refetches for stale queries)
		await page.evaluate(() => {
			window.dispatchEvent(new Event("blur"));
			window.dispatchEvent(new Event("focus"));
		});

		// Wait for any potential refetch to complete
		await page.waitForTimeout(1000);

		// The edit should persist (staleTime: Infinity prevents refetch from overwriting)
		await expect(taglineInput).toHaveValue("My edited tagline");
	});
});
