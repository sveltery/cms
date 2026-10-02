// Ported unchanged source declaration bodies from EmDash 1.1.0
// e2e/tests/content-crud.spec.ts:63 and :79 at
// 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e. MIT Copyright 2026 Cloudflare Inc.
// See notices/emdash-MIT.txt and docs/native-content-editor.md.
// Native Kit route/auth fixture substitution; source published-fixture scope is pending.
import { test, expect } from '../helpers/native-editor-source-fixture';

const CONTENT_EDIT_URL_PATTERN = /\/content\/posts\/[A-Z0-9]+(?:\?.*)?$/;
test.describe('Create Content', () => {
  test.beforeEach(async ({ admin }) => { await admin.devBypassAuth(); });

	test("creates new post with title", async ({ admin }) => {
		await admin.goToNewContent("posts");
		await admin.waitForLoading();

		// Fill in title
		await admin.fillField("title", "E2E Test Post");

		// Save
		await admin.clickSave();

		// Should redirect to edit page with new ID (ULID)
		await expect(admin.page).toHaveURL(CONTENT_EDIT_URL_PATTERN, {
			timeout: 10000,
		});
	});

	test("auto-generates slug from title", async ({ admin }) => {
		await admin.goToNewContent("posts");
		await admin.waitForLoading();

		// Fill in title — slug should auto-generate
		await admin.fillField("title", "My Amazing Blog Post");

		// Check that slug field was auto-populated
		const slugInput = admin.page.getByLabel("Slug");
		await expect(slugInput).toHaveValue("my-amazing-blog-post");
	});
});
