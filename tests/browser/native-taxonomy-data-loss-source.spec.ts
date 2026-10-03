// Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
// Complete unchanged EmDash 1.1.0 form-data-loss.spec.ts:113 callback.
import {test,expect} from "../helpers/native-taxonomy-source-fixture";
test("taxonomy checkboxes clear when all terms are removed", async ({
		admin,
		page,
		serverInfo,
	}) => {
		// Navigate to a published post that we can assign terms to
		const postId = serverInfo.contentIds["posts"]?.[0];
		if (!postId) {
			test.skip();
			return;
		}

		await admin.goToEditContent("posts", postId);
		await admin.waitForLoading();

		// Wait for the taxonomy sidebar to load
		const taxonomyHeading = page.locator("h3", { hasText: "Taxonomies" });
		await expect(taxonomyHeading).toBeVisible({ timeout: 10000 });
		await page.getByRole("button", { name: "Choose Categories" }).click();

		// Find the category checkboxes
		const newsCheckbox = page.getByRole("checkbox", { name: "News" });
		const tutorialsCheckbox = page.getByRole("checkbox", { name: "Tutorials" });

		// Check two categories
		await newsCheckbox.check();
		await page.waitForTimeout(500); // Wait for auto-save
		await tutorialsCheckbox.check();
		await page.waitForTimeout(500); // Wait for auto-save

		// Verify both are checked
		await expect(newsCheckbox).toBeChecked();
		await expect(tutorialsCheckbox).toBeChecked();

		// Now uncheck both — this is the bug scenario from PR #133
		await newsCheckbox.uncheck();
		await page.waitForTimeout(500);
		await tutorialsCheckbox.uncheck();
		await page.waitForTimeout(500);

		// All checkboxes should be unchecked (the old bug would leave stale checks)
		await expect(newsCheckbox).not.toBeChecked();
		await expect(tutorialsCheckbox).not.toBeChecked();
		await expect(page.getByRole("checkbox", { name: "Opinion" })).not.toBeChecked();

		// Reload to verify server state matches
		await page.reload();
		await admin.waitForShell();
		await admin.waitForLoading();

		// After reload, all should still be unchecked
		await expect(taxonomyHeading).toBeVisible({ timeout: 10000 });
		await page.getByRole("button", { name: "Choose Categories" }).click();
		await expect(page.getByRole("checkbox", { name: "News" })).not.toBeChecked();
		await expect(page.getByRole("checkbox", { name: "Tutorials" })).not.toBeChecked();
		await expect(page.getByRole("checkbox", { name: "Opinion" })).not.toBeChecked();
	})
