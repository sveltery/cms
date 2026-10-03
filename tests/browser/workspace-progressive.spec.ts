import { test, expect } from '@playwright/test';
import { schemaAdminRemotes } from '../helpers/schema-admin-remotes';

// Original native progressive-host requirements. Existing persisted test sessions
// exercise actual principal composition; no source or authentication credit.
for (const target of ['Node', 'D1'] as const) {
  test(`${target} narrow authenticated navigation works without JavaScript`, async ({ browser }) => {
    const fixture = await schemaAdminRemotes(target);
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
    try {
      await fixture.registry.createCollection({ slug: 'articles', label: 'Articles', group: 'Editorial' });
      await fixture.registry.createField('articles', { slug: 'title', label: 'Title', type: 'string' });
      await context.addCookies([{ name: 'cms-session', value: fixture.tokens.admin, url: fixture.origin }]);
      const page = await context.newPage();
      const response = await page.goto(`${fixture.origin}/content/articles`);
      expect(response?.status()).toBe(200);
      const navigation = page.locator('nav[aria-label="Workspace"]');
      const account = page.locator('.account-link');
      await expect(navigation).toHaveCount(1);
      await expect(navigation).toContainText('Articles');
      await expect(account).toHaveText('Your account');
      await expect(navigation).toBeVisible();
      const collection = navigation.getByRole('link', { name: 'Articles', exact: true });
      await expect(collection).toBeVisible();
      await expect(collection).toHaveAttribute('aria-current', 'page');
      await expect(navigation.getByRole('link', { name: 'Schema', exact: true })).toBeVisible();
      await expect(account).toBeVisible();
      const folder = navigation.locator('summary').filter({ hasText: /^Editorial$/ });
      await folder.click();
      await expect(collection).toBeHidden();
      await folder.click();
      await expect(collection).toBeVisible();
      await navigation.getByRole('link', { name: 'Schema', exact: true }).click();
      await expect(page).toHaveURL(`${fixture.origin}/schema`);
      await expect(navigation).toBeVisible();
      await page.locator('.account-link').click();
      await expect(page).toHaveURL(`${fixture.origin}/login`);
    } finally { await context.close(); await fixture.close(); }
  });
}
