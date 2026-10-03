// @ts-nocheck -- complete pinned callbacks with native trusted WebAuthn fixture.
// EmDash1.1.0 MIT2026 Cloudflare Inc.; notices/emdash-MIT.txt.
import {test as base,expect} from '@playwright/test';
import {mkdirSync,existsSync,writeFileSync,readFileSync} from 'node:fs';import {join} from 'node:path';
import {passkeyRuntime} from '../helpers/passkey-runtime';import {addVirtualWebAuthnAuthenticator} from '../helpers/virtual-authenticator';import {completeFullSetup} from '../helpers/full-setup-browser';
const test=base.extend({admin:async({page,context},use)=>{
 const h=await passkeyRuntime('Node');const removeAuthenticator=await addVirtualWebAuthnAuthenticator(page);
 try{await page.goto(h.origin+'/setup');await completeFullSetup(page,'media@example.com','Media Admin');
 await use({page,goToMedia:()=>page.goto(h.origin+'/media'),waitForLoading:()=>page.waitForLoadState('networkidle'),expectPageTitle:title=>expect(page.getByRole('heading',{name:title,exact:true})).toBeVisible()});
 }finally{await removeAuthenticator();await h.close();}
}});
const TEST_ASSETS_DIR=join(process.cwd(),'test-results/media-source-assets');
const MEDIA_API_RESPONSE_PATTERN=/\/api\/media/;const UPLOAD_BUTTON_REGEX=/Upload/;const BROWSE_FILES_LABEL='Browse files to upload';
function ensureTestAssets(): string {
	if (!existsSync(TEST_ASSETS_DIR)) {
		mkdirSync(TEST_ASSETS_DIR, { recursive: true });
	}

	// Create a simple test PNG (1x1 red pixel)
	const testImagePath = join(TEST_ASSETS_DIR, "test-image.png");
	if (!existsSync(testImagePath)) {
		// Minimal valid PNG file (1x1 red pixel)
		const pngData = Buffer.from([
			0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44,
			0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90,
			0x77, 0x53, 0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8,
			0xcf, 0xc0, 0x00, 0x00, 0x00, 0x03, 0x00, 0x01, 0x00, 0x05, 0xfe, 0xd4, 0xef, 0x00, 0x00,
			0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
		]);
		writeFileSync(testImagePath, pngData);
	}

	return testImagePath;
}

async function uploadTestImage(page: Page, filename?: string) {
	const testImagePath = ensureTestAssets();
	await page.getByRole("button", { name: UPLOAD_BUTTON_REGEX }).first().click();
	const dialog = page.getByRole("dialog");
	await expect(dialog).toBeVisible();

	const uploadResponse = page.waitForResponse(
		(res) =>
			MEDIA_API_RESPONSE_PATTERN.test(res.url()) &&
			res.request().method() === "POST" &&
			res.status() === 200,
		{ timeout: 10000 },
	);
	await dialog.getByLabel(BROWSE_FILES_LABEL).setInputFiles(
		filename
			? {
					name: filename,
					mimeType: "image/png",
					buffer: Buffer.concat([readFileSync(testImagePath), Buffer.from(filename)]),
				}
			: testImagePath,
	);
	await uploadResponse;
	await expect(dialog.getByText("Complete", { exact: true })).toBeVisible();
	await dialog.getByRole("button", { name: "Done" }).click();
	await expect(dialog).not.toBeVisible();
}

test.describe("Complete pinned basic media library callbacks",()=>{
test("displays media library page", async ({ admin }) => {
			await admin.goToMedia();
			await admin.waitForLoading();

			// Should show the media library heading
			await admin.expectPageTitle("Media Library");

			// Should have upload button
			await expect(
				admin.page.getByRole("button", { name: UPLOAD_BUTTON_REGEX }).first(),
			).toBeVisible();
		});

test("shows grid view by default", async ({ admin, page }) => {
			await admin.goToMedia();
			await admin.waitForLoading();
			await uploadTestImage(page);

			// Grid view tab should be active
			const gridTab = admin.page.getByRole("tab", { name: "Grid view" });
			await expect(gridTab).toBeVisible();
			await expect(gridTab).toHaveAttribute("aria-selected", "true");
		});

test("shows view toggle tabs", async ({ admin, page }) => {
			await admin.goToMedia();
			await admin.waitForLoading();
			await uploadTestImage(page);

			await expect(admin.page.getByRole("tab", { name: "Grid view" })).toBeVisible();
			await expect(admin.page.getByRole("tab", { name: "List view" })).toBeVisible();
		});

test("uploads a new image file", async ({ admin, page }) => {
			await admin.goToMedia();
			await admin.waitForLoading();

			// Upload file
			await uploadTestImage(page);

			// Wait for the uploaded image to appear in the media grid
			const mediaGrid = page.locator("[data-media-grid]");
			await expect(mediaGrid.locator("img").first()).toBeVisible({ timeout: 5000 });

			// Should have at least one image in the grid now
			const images = mediaGrid.locator("img");
			const count = await images.count();
			expect(count).toBeGreaterThan(0);
		});
});
