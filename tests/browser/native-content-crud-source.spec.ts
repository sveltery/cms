// Unchanged complete declaration bodies selected from EmDash1.1.0
// e2e/tests/content-crud.spec.ts:27/:48/:143/:158/:185, immutable
// 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e. MIT Copyright2026 Cloudflare Inc.
// See notices/emdash-MIT.txt and docs/native-content-editor.md.
// Native fixture substitution uses actual lifecycle-created/published rows.
import { test, expect } from '../helpers/native-editor-source-fixture';
const CONTENT_ID_PATTERN = /\/content\/posts\/[A-Z0-9]+(?:\?.*)?$/;
const NEW_CONTENT_URL_PATTERN = /\/content\/posts\/new(?:[?#].*)?$/;
test.describe('Native scalar CRUD source contracts',()=>{
 test.beforeEach(async({admin})=>{await admin.devBypassAuth();});
test("displays content list with seeded items", async ({ admin }) => {
			await admin.goToContent("posts");
			await admin.waitForLoading();

			// Should show the posts heading
			await admin.expectPageTitle("Posts");

			// Should have a table with content
			await expect(admin.page.locator("table")).toBeVisible();

			// Should show seeded posts
			await expect(admin.page.getByRole("link", { name: "First Post", exact: true })).toBeVisible();
			await expect(
				admin.page.getByRole("link", { name: "Second Post", exact: true }),
			).toBeVisible();
			await expect(admin.page.getByRole("link", { name: "Draft Post", exact: true })).toBeVisible();

			// Should have "Add New" link
			await expect(admin.page.getByRole("link", { name: "Add New" })).toBeVisible();
		});

test("clicking Add New navigates to content editor", async ({ admin }) => {
			await admin.goToContent("posts");
			await admin.waitForLoading();

			// Click Add New
			await admin.page.getByRole("link", { name: "Add New" }).click();

			// Should navigate to new content page
			await expect(admin.page).toHaveURL(NEW_CONTENT_URL_PATTERN, {
				timeout: 10000,
			});
		});

test("loads existing content for editing", async ({ admin }) => {
			// Go to content list
			await admin.goToContent("posts");
			await admin.waitForLoading();

			// Click on first content item to edit
			await admin.page.getByRole("link", { name: "First Post", exact: true }).click();

			// Should be on edit page
			await expect(admin.page).toHaveURL(CONTENT_ID_PATTERN);

			// Title field should be populated
			await expect(admin.page.locator("#field-title")).toHaveValue("First Post");
		});

test("saves updated content", async ({ admin }) => {
			// Navigate to existing content
			await admin.goToContent("posts");
			await admin.waitForLoading();

			// Click first item to edit
			await admin.page.getByRole("link", { name: "First Post", exact: true }).click();
			await admin.waitForLoading();

			// Update title
			const newTitle = `Updated Post ${Date.now()}`;
			await admin.fillField("title", newTitle);

			// Save
			await admin.clickSave();
			await admin.waitForSaveComplete();

			// Verify the update persisted by reloading
			await admin.page.reload();
			await admin.waitForShell();
			await admin.waitForLoading();

			await expect(admin.page.locator("#field-title")).toHaveValue(newTitle);
		});

test("displays content status badges", async ({ admin }) => {
			await admin.goToContent("posts");
			await admin.waitForLoading();

			// Should show status badges (published and draft)
			const statusBadges = admin.page.locator("span.inline-flex");
			const count = await statusBadges.count();
			expect(count).toBeGreaterThan(0);
		});
});
