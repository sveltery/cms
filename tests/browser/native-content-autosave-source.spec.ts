// Complete unchanged declaration bodies from pinned e2e/tests/autosave.spec.ts.
// EmDash1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e, MIT Cloudflare Inc.
// Native fixture substitutes setup and actual Kit URL/envelope transport only.
import { test, expect } from '../helpers/native-editor-autosave-fixture';
test.describe('Native scalar autosave source contracts', () => {
  let collectionSlug: string;
  let postId: string;
  let headers: Record<string, string>;
  let baseUrl: string;
  let fetch: typeof globalThis.fetch;
  let admin: any;
  test.beforeEach(async ({ nativeAutosave }) => {
    ({ collection: collectionSlug, id: postId, origin: baseUrl, fetch, admin } = nativeAutosave);
    headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${nativeAutosave.token}`, 'X-EmDash-Request': '1', Origin: baseUrl };
    await admin.devBypassAuth();
  });
	test("multiple autosaves update draft in place instead of creating new revisions", async ({
		admin,
	}) => {
		const contentUrl = `/_emdash/api/content/${collectionSlug}/${postId}`;
		const isPut = (res: any) => res.url().includes(contentUrl) && res.request().method() === "PUT";
		const isGet = (res: any) =>
			res.url().includes(contentUrl) &&
			!res.url().includes("/revisions") &&
			res.request().method() === "GET";

		await admin.goToEditContent(collectionSlug, postId);
		await admin.waitForLoading();

		const titleInput = admin.page.locator("#field-title");
		await expect(titleInput).toHaveValue("Original");

		// First edit — listen for both the PUT and the subsequent cache re-fetch GET
		const firstPut = admin.page.waitForResponse(isPut, { timeout: 10000 });
		await titleInput.fill("Edit One");
		await firstPut;

		// Wait for the cache invalidation GET to settle so form doesn't get overwritten
		const refetchGet = admin.page.waitForResponse(isGet, { timeout: 5000 }).catch(() => {});
		await refetchGet;
		// Extra settle time for React state updates
		await admin.page.waitForTimeout(500);

		// Check revision count after first autosave
		const res1 = await fetch(
			`${baseUrl}/_emdash/api/content/${collectionSlug}/${postId}/revisions`,
			{ headers },
		);
		const data1: any = await res1.json();
		const countAfterFirst = data1.data.total;

		// Second edit — set up listener BEFORE typing
		const secondPut = admin.page.waitForResponse(isPut, { timeout: 10000 });
		await titleInput.fill("Edit Two");
		await secondPut;

		// Check revision count — should be same (updated in place, not new revision)
		const res2 = await fetch(
			`${baseUrl}/_emdash/api/content/${collectionSlug}/${postId}/revisions`,
			{ headers },
		);
		const data2: any = await res2.json();
		const countAfterSecond = data2.data.total;

		expect(countAfterSecond).toBe(countAfterFirst);

		// Verify the latest revision contains the last autosaved data
		const latestRevision = data2.data.items?.[0];
		expect(latestRevision?.data?.title).toBe("Edit Two");
	});

	test("does not resend a rejected autosave until the content changes", async ({ admin }) => {
		await fetch(`${baseUrl}/_emdash/api/schema/collections/${collectionSlug}/fields`, {
			method: "POST",
			headers,
			body: JSON.stringify({
				slug: "summary",
				type: "string",
				label: "Summary",
				validation: { minLength: 10 },
			}),
		});

		const contentUrl = `/_emdash/api/content/${collectionSlug}/${postId}`;
		const isPut = (res: any) => res.url().includes(contentUrl) && res.request().method() === "PUT";
		const putStatuses: number[] = [];
		admin.page.on("response", (res) => {
			if (isPut(res)) putStatuses.push(res.status());
		});

		await admin.goToEditContent(collectionSlug, postId);
		await admin.waitForLoading();

		const summaryInput = admin.page.locator("#field-summary");
		const rejectedPut = admin.page.waitForResponse(isPut, { timeout: 10000 });
		await summaryInput.fill("short");
		expect((await rejectedPut).status()).toBe(400);

		await admin.page.waitForTimeout(7000);
		expect(putStatuses).toEqual([400]);
		await expect(summaryInput).toHaveValue("short");

		const acceptedPut = admin.page.waitForResponse(isPut, { timeout: 10000 });
		await summaryInput.fill("long enough now");
		expect((await acceptedPut).status()).toBe(200);
	});

	test("names the rejected field by its label", async ({ admin }) => {
		await fetch(`${baseUrl}/_emdash/api/schema/collections/${collectionSlug}/fields`, {
			method: "POST",
			headers,
			body: JSON.stringify({
				slug: "excerpt",
				type: "string",
				label: "Summary",
				validation: { minLength: 10 },
			}),
		});

		const contentUrl = `/_emdash/api/content/${collectionSlug}/${postId}`;
		const isPut = (res: any) => res.url().includes(contentUrl) && res.request().method() === "PUT";

		await admin.goToEditContent(collectionSlug, postId);
		await admin.waitForLoading();

		const rejectedPut = admin.page.waitForResponse(isPut, { timeout: 10000 });
		await admin.page.locator("#field-excerpt").fill("short");
		expect((await rejectedPut).status()).toBe(400);

		await expect(admin.page.getByText("Summary needs at least 10 characters.")).toBeVisible();
		await expect(admin.page.getByText("excerpt:", { exact: false })).toHaveCount(0);
	});
});
